Source backend tersedia, jadi klasifikasi D-A6R2-01 bisa dibuktikan dari kode: **D, bug di repository/ORM update.** Repository menyimpan Content lewat `db.Updates(struct)` tanpa `Select`, dan GORM hanya menulis kolom yang nilainya bukan zero-value. Karena `false` adalah zero-value untuk `bool`, kolom `is_active` tidak pernah masuk ke SQL UPDATE, sedangkan `name` dan `value` ikut ter-update.

Seluruh investigasi read-only: tidak ada request HTTP, tidak ada mutation, dan tidak ada perubahan pada source, test, config, dokumentasi, atau status gate. Repo backend: `~/Developments/BE/gpos-b2b-content-service`, branch `development`, commit `7897199`, working tree bersih.

### Finding

`is_active=false` dibawa dengan benar dari request sampai ke model. Nilai itu baru hilang di repository, pada pemanggilan `repo.db.Updates(content)`. Kode GORM v1.31.0 menunjukkan bahwa saat `Updates` menerima struct tanpa `Select`, field zero-value tidak mendapat assignment. Ini persis sama dengan hasil live A6R-2.

### Evidence chain

```text
PUT endpoint
File:   handler/content.go
Line:   31-35 (route), 175-199 (handler)
Evidence: cmsGroup := group.Group("/cms/"); cmsGroup.Put("/contents/:id", h.CmsUpdateContent).
          The handler only runs ValidateParam → ValidateBody → mapper → use case → 200 {message:"Success"};
          nothing in it handles is_active.
Status: VERIFIED

DTO
File:   dto/content.go
Line:   42-47 (field at 46)
Evidence: IsActive bool `json:"is_active"`. A plain bool: no pointer, no omitempty, no validate tag.
          A JSON `false` and a missing field both decode to false, so they can't be told apart.
Status: VERIFIED

Decoding + validation
File:   helper/validator.go:35-45 (ValidateBody), 15-33 (ValidateStruct); server/httpserver.go:23 (fiber.New(), default decoder)
Evidence: c.BodyParser(request) uses Fiber's default JSON decoder, then validator.Struct.
          The only rules are code/name `required`; there is no rule for is_active.
          The false value survives decoding and validation unchanged.
Status: VERIFIED

Service/UseCase
File:   usecase/content.go
Line:   68-82
Evidence: GetContentById (record exists) → GetContentByCode (code is unique) → ToContentModelFromUpdateSpec → UpdateContent.
          No conditional logic on IsActive.
Status: VERIFIED

Mapper
File:   mapper/content.go
Line:   55-61 (spec), 63-74 (model; IsActive at 72)
Evidence: IsActive: spec.IsActive. The mapping is explicit and unconditional, so false is carried into model.Content.
Status: VERIFIED

Repository
File:   repository/content.go
Line:   66-74 (call at 67)
Evidence: err := repo.db.Updates(content).Error. A struct update with no Select, Omit or map.
Status: VERIFIED

ORM
File:   ~/go/pkg/mod/gorm.io/gorm@v1.31.0/callbacks/update.go (go.mod:26 → gorm v1.31.0)
Line:   140-142 (selectColumns, restricted), 268-289 (struct branch)
Evidence: value, isZero := field.ValueOf(...) ; if (ok || !isZero) && field.Updatable { set = append(...) }.
          With no Select, ok = false, so the zero value false gets no assignment and is_active is not
          in the SQL UPDATE. The non-empty name and value strings are included.
Status: VERIFIED (GORM source code). The SQL that actually ran wasn't captured, so that part is INFERRED.

DB model/schema
File:   model/content.go:3-9 (IsActive at 8); config/migration.go:11-13 (AutoMigrate &model.Content{}); seed.sql:6, 20
Evidence: IsActive bool `gorm:"default:true;not null"`. The schema comes from AutoMigrate.
          No trigger, no hook (no Before/After method on Content), no generated column.
          seed.sql doesn't set is_active, so the DB default true applies.
Status: VERIFIED (code). The live database schema itself wasn't checked: UNKNOWN.

Response
File:   repository/content.go:42-55 (list), usecase/content.go:39-50 (detail), mapper/content.go:8-33
Evidence: GET reads model.Content from the DB, and the mapper copies IsActive: p.IsActive / data.IsActive.
          It is not a default value made up by the mapper.
Status: VERIFIED
```

### D-A6R2-01

```text
Classification: D — Repository/ORM update bug
                (with a contributing factor: plain bool in the DTO and model, so false can't be told apart from "not sent")
Severity:       CRITICAL — deactivation is silently lost: the backend returns 200 and the CMS shows "saved"
Status:         OPEN
Reason:         `false` makes it intact to the model (DTO, validation, use case and mapper all VERIFIED).
                GORM `Updates(struct)` without `Select` leaves out zero-value fields
                (update.go:289, VERIFIED from source). This matches live A6R-2 exactly:
                name and value persisted, is_active did not.
```

How the other categories were ruled out:

| Category | Assessment | Status |
|---|---|---|
| A. Deliberately ignored | DTO, mapper and Swagger all accept and pass `is_active` through; no comment or rule excludes it | INFERRED: not deliberate |
| B. Separate endpoint | The Content routes are CRUD only. `PUT /:id/statuses` exists only for Article (`handler/cms_article.go:29`) | VERIFIED (this repo) |
| C. DTO/mapper bug | The value isn't lost there; it's carried unchanged | VERIFIED |
| E. Business rule | None in the use case, handler, hooks or a trigger | VERIFIED |

### Contract assessment

1. **OpenAPI:** `docs/docs.go:1709-1729` is generated by swaggo from the `dto.CmsUpdateContentRequest` struct (header says "Code generated by swaggo/swag. DO NOT EDIT"). So `is_active` is documented as writable because it really is part of the DTO the endpoint uses, not hand-written documentation. VERIFIED.
2. **Backend implementation:** `is_active=true` gets written, but `false` is dropped at the ORM layer. VERIFIED from code.
3. **A6R-2 live behavior:** PUT returned 200 and the read-back showed `is_active=true`. This matches item 2.

**There is contract drift:** the spec and the request DTO say `is_active` is writable, but in practice it can only be changed to `true`, not to `false`. The frontend contract (`PUT` with `is_active` as a boolean) matches the spec.

Two related findings, VERIFIED from code but not run live:
- **CREATE with `is_active=false` will be saved as `true`.** The model has `default:true`, and GORM `callbacks/create.go:336-343` replaces a zero value with the default value. A6R-1 only tested `true`.
- **The backend's update unit test doesn't catch this**, because the repository is mocked (`test/usecase/content/update_content_test.go:19-25`).

**Not yet verified:** that `devb2b-api.gpos.id` actually runs commit `7897199` (UNKNOWN).

### Recommendation

1. **Confirm the backend version.** Ask the backend owner to confirm `devb2b-api.gpos.id` runs `7897199` or equivalent code. This is the last gap between code evidence and runtime behavior.
2. **Hand D-A6R2-01 to the backend owner, with file and line references:**
   - `repository/content.go:67`
   - `model/content.go:8`
   - `dto/content.go:46`
   - `gorm@v1.31.0/callbacks/update.go:289`
   - `callbacks/create.go:336-343`

   The fix is the backend owner's decision. Common options: `Select(...)`/`Select("*")` on the update, an update using a `map`, or `*bool` on the DTO/model. The same fix should also cover the CREATE path.
3. **Change nothing in the frontend.** Removing `is_active` from the form or forcing it to `true` would only hide the contract drift.
4. **After the backend fix is deployed,** run a separate, approved phase to verify `is_active=false` live on UPDATE (and CREATE). It should be one-shot, include read-back, and, if possible, record the request body.

Current status is unchanged:

```text
A6R-1 CREATE = VERIFIED
A6R-2 UPDATE = NOT FULLY VERIFIED
D-A6R2-01    = OPEN / CRITICAL (classified D, backend)
A6           = BLOCKED
```
