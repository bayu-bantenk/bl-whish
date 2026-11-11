# Phase 5.3g.3 — Credit parser contract (F-2)

> **Ringkasan (ID):** Parser saldo sekarang memakai tata bahasa angka yang eksplisit. Tanda baca tidak pernah
> dibuang dan digit tidak pernah digabung. `50.5.5`, `5,0,0`, `50..0`, `50,,0` dan angka negatif ditolak. Format
> titik seperti `1.000` dianggap ambigu dan tidak pernah dijadikan angka.

Module: `src/blatifa/account/balance.py` (`parse_balance`, `parse_number`). The legacy `account.reader.parse_credits`
now delegates to it and returns the value only when the result is `VALID`.

## Root cause (F-2)

```python
CREDITS = re.compile(r"^(?P<n>\d[\d,.]*) Google Flow credits?$")   # any mix of digits, ',' and '.'
digits = re.sub(r"[,.]", "", match["n"])                            # punctuation dropped, digits joined
```

`"50.5.5"` → `"5055"`, `"5,0,0"` → `"500"`, `"1.000"` → `1000` (a locale guess). `\d` also matched non-ASCII digits.

## Grammar

| Rule | Pattern (ASCII digits only) | Result |
|---|---|---|
| plain | `0` or `[1-9][0-9]{0,8}` | `VALID` |
| grouped | `[1-9][0-9]{0,2}(,[0-9]{3})+` | `VALID` (commas removed only after the strict grouping matched) |
| dotted | `[1-9][0-9]{0,2}(\.[0-9]{3})+` | `AMBIGUOUS` (thousands or decimal; never guessed) |
| starts with `-` or `−` | | `INVALID_FORMAT` / `NEGATIVE` |
| digits only, but leading zero or > 9 digits | | `INVALID_FORMAT` |
| anything else containing a digit | | `INVALID_FORMAT` / `MALFORMED_NUMBER` |
| no digit | | `INVALID_FORMAT` / `NO_NUMBER` |
| empty / whitespace / `None` | | `MISSING` |

Locale evidence: the Flow UI is en-US ("Credits refresh daily at 3:37 PM", English labels; 5.3g.2 D-3), so only the
en-US comma grouping is accepted, and only in strict three-digit groups. The comma grouping keeps the existing,
unchanged assertion `"1,250 Google Flow credits" → 1250` (`test_core.py`). Flow has only been observed showing plain
integers (40, 50). Dot grouping has no evidence, so it is `AMBIGUOUS`.

## Labels and context

| Context | Accepted shapes |
|---|---|
| `Context.ANY_TEXT` (default; any page text) | `N Google Flow credit(s)` only, exact label and single spaces |
| `Context.PROVEN_BALANCE_SOURCE` (the caller has already proven that the source is the balance) | `N Google Flow credit(s)`, `N credit(s)`, `N` |

So `"50 credits"` and `"50"` are 50 **only** when the source is proven, as the brief requires. In page text they are
`INVALID_FORMAT` / `NOT_A_BALANCE_LABEL`. Sentences ("Costing 10 credits", "12 tiles", "Balance: 50 …") never parse
in either context. No production caller uses `PROVEN_BALANCE_SOURCE` for page text yet. It is used by `user_reported`
and is available for Phase 5.3g.4.

## Result

`BalanceParse(kind, value, reason, text)`, frozen. `value` is set **if and only if** `kind is VALID` (enforced in
`__post_init__`, and never negative). Callers cannot read a number out of an `AMBIGUOUS` or `INVALID_FORMAT` result.

`account.reader.CREDITS` (still exported) is now strict too:
`^(0|[1-9][0-9]{0,8}|[1-9][0-9]{0,2}(,[0-9]{3})+) Google Flow credits?$` (ASCII).
