# A1 — Legacy Route / Screen Discovery (gpos-b2b-cms)

| Item | Value |
|---|---|
| Phase | A1: static Route → Screen → Capability discovery |
| Date | 2026-09-28 |
| Repository | `gpos-b2b-cms/` (AdonisJS 4.1), read-only |
| Inputs | A0 `FRONTEND_SCOPE.md` (GO); B0 target baseline (GO) |
| Evidence labels | `[SOURCE]` = read in code · `[INFERRED]` = concluded from source, not executed · `[UNKNOWN — VERIFY A3]` = needs runtime |
| Method | (1) Scripted static extraction of `start/routes.js`, `app/Controllers/Http/**`, `resources/views/**`, `app/Mapper*/**`, `app/Validators/**` and the `Extender.js` menus. (2) Six read-only deep reads, one per feature group, tracing view → inline JS → `main.js` → route → controller → mapper → validator. No screenshots and no runtime. |

Legacy terminology is kept verbatim throughout: route names, field names, Indonesian labels and flash texts. Nothing has been normalised.

---

## 1. Executive Summary

**Routes.** `start/routes.js` makes 247 route calls: 217 explicit routes and 30 `Route.resource` calls. Expanded, these give 427 route entries. 330 of them are relevant to the frontend. The other 97 are resource routes whose controller action does not exist (§3.3).

**Screens.** There are 107 route→view screens (§4). They cover 98 existing view files plus 3 view names that are missing (`product_gposb2b_homepages/*`).

| Status | Screens |
|---|---|
| ACTIVE-CANDIDATE | 82 |
| UNKNOWN (works but has no link to it, is a static mockup, or is partly broken) | 22 |
| MISSING-VIEW | 3 |

**Feature areas.** 32, named with the legacy menu labels (§23).

**Rendering.** Every screen is server-rendered Edge on `layouts.edge`, except `login.edge`, which is standalone.

**Lists.** Two mechanisms are used:
- DataTables through `$.fn.buildtable`: 32 calls in 32 views. These use server-side processing, and the row HTML is built by Mappers or Controllers.
- Custom JSON plus `pagination.js`, or server-rendered cards: 9 list-type screens.

**Backend-generated UI.** 34 functions in Mappers, Controllers and Helpers emit HTML. They produce Edit/Delete/Detail/Cancel/Sync buttons, toggles, inline sequence inputs, status badges and entire notification cards. None of them has a role or email condition (§8).

**Navigation.** Three hardcoded menu sets are chosen by `authUser.user_email`: Payment (2 items), Marketing (3) and Superadmin (31). Several functional screens have no menu or hub entry because their cards are commented out:
- Inject Point
- Mutasi/Redeem
- Voucher Setting
- Gamification "Bertingkat"
- CustomCatalogProductHomepage and CustomCriteria (standalone screens)

**Orphans.** All 21 orphan views are LIKELY UNUSED (§24). In addition, 5 routed views are static mockups.

**Major findings (§27):**
- Failure flash messages are often never shown: the capital-`W` `Warning` key is never rendered, and list pages read the wrong keys.
- Bulk-delete flash messages are inverted on some screens.
- JSON endpoints answer with `redirect('back')`.
- Some forms and links point to actions that don't exist.
- Browser exports cover only the current page.
- Order bulk delete is broken.
- Deleting a Principal redirects to `/custom-catalog`.

**Decision: GO** (§29).

## 2. Audit Scope

**In scope.** Everything A0 classified as MUST MIGRATE or SHARED:
- `resources/views/**`
- `public/assets/js/{main,cms-toastify,pagination}.js`
- `start/routes.js`, `start/hooks.js`
- `app/Middleware/{Extender,AuthSession,ExtendResponse}.js`
- `app/Helper/{Authorization,DatatableBuilder}.js`
- `app/Mapper/**`, `app/Mappers/**`, `app/Validators/**`, `app/Controllers/Http/**`
- `config/{app,shield,session}.js`

**Out of scope:**
- Gateway API semantics beyond the request/response shaping visible in Mappers (A2).
- What the permissions mean (A2).
- Runtime and visual behavior (A3).
- Any Next.js work.

**Reproducibility.** The extraction scripts live in `/tmp/a1/*.js`, outside both repos, and write `/tmp/a1/*.json`. Re-running them against the same commit regenerates the generated tables.

---

## 3. Route Inventory (A1.1)

**Middleware.**
- Global stack on every route: `BodyParser, Session, Shield(CSRF), AuthInit, ConvertEmptyStringsToNull, ExtendResponse, Extender` (`start/kernel.js:22-30`).
- `authSession` group: every route except `/`, `/login` and `/logout` (`routes.js:23,554`).

**How routes were classified:**

| Type | Rule |
|---|---|
| DATATABLE | URL or action name contains `datatable` |
| OPTIONS | Contains `options`, `point-types`, `channel-type`, `list-options` or `platform-options` |
| SEARCH | Contains `search` |
| UPLOAD | `signurl` or `upload` |
| DOWNLOAD | `csv`, `generate` or `download`, with no view rendered |
| DELETE / MULTI_DELETE | By name, or by the DELETE HTTP method |
| AUTHENTICATED_PAGE | The action renders a view |
| FORM_SUBMISSION | A non-GET route that redirects |
| AJAX_ACTION | A non-GET route that returns a body |
| MISSING-ACTION | The controller does not define the method |

**Route names.** The route name is the handler string (`Controller.action`). There is only one `.as()` alias: `LoyaltyMemberController.generateCardCsv`.

**Shadowing.** Adonis uses the first registered match.
- 18 routes are exact duplicates of an earlier registration (marked `Shadowed=YES`). They point to the same handler, so no behavior changes.
- One is a real parameter shadow: `GET /loyalty-member/create` is caught by the earlier `GET /loyalty-member/:id` [INFERRED].

**Explicit routes whose action does not exist** [SOURCE]:
- `POST /poin-voucher/redeem/reguler/search` → `MutasiRedeemPoinController.searchFilterReguler`
- `POST /inventories/:inventoryId/inventory-stocks/datatable` → `InventoryStockController.datatable`
- `GET /sponsored-products/search-product` → `SponsoredProductController.searchProduct`

### 3.1 Route type totals

| Type | Count |
|---|---|
| PUBLIC_PAGE | 1 |
| FORM_SUBMISSION | 60 |
| REDIRECT | 3 |
| AUTHENTICATED_PAGE | 114 |
| DATATABLE | 32 |
| DELETE | 26 |
| MULTI_DELETE | 23 |
| OPTIONS | 28 |
| MISSING-ACTION | 101 |
| AJAX_ACTION | 18 |
| OTHER | 6 |
| AUTHENTICATED_PAGE(POST-rendered) | 5 |
| SEARCH | 2 |
| UPLOAD | 4 |
| DOWNLOAD | 4 |

### 3.2 Frontend-relevant route inventory (330 rows; resource-expanded routes whose action does not exist are summarised in 3.3)

| # | Line | Method | URL | Handler (Controller.action = Adonis route name) | Middleware | Type | Menu | Shadowed | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| R001 | 19 | GET | `/` | AuthController.getLogin | global | PUBLIC_PAGE | - | - | routes.js:19 |
| R002 | 20 | POST | `/login` | AuthController.postLogin | global | FORM_SUBMISSION | - | - | routes.js:20 |
| R003 | 21 | GET | `/logout` | AuthController.getLogout | global | REDIRECT | - | - | routes.js:21 |
| R004 | 24 | GET | `/home` | HomeController.home | global+authSession | AUTHENTICATED_PAGE | Payment(hidden),Marketing(hidden),Superadmin | - | routes.js:24 |
| R005 | 27 | GET | `/principal` | PrincipalController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:27 |
| R006 | 28 | POST | `/principal/datatable` | PrincipalController.datatable | global+authSession | DATATABLE | - | - | routes.js:28 |
| R007 | 29 | POST | `/principal/delete` | PrincipalController.delete | global+authSession | DELETE | - | - | routes.js:29 |
| R008 | 30 | POST | `/principal/multidelete` | PrincipalController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:30 |
| R009 | 31 | GET | `/principal/options` | PrincipalController.getPrincipalOptions | global+authSession | OPTIONS | - | - | routes.js:31 |
| R010 | 32 | GET | `/principal` | PrincipalController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:32 |
| R011 | 32 | GET | `/principal/create` | PrincipalController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:32 |
| R012 | 32 | POST | `/principal` | PrincipalController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:32 |
| R013 | 32 | GET | `/principal/:id/edit` | PrincipalController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:32 |
| R014 | 32 | PUT|PATCH | `/principal/:id` | PrincipalController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:32 |
| R015 | 35 | GET | `/feedback` | FeedbackController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:35 |
| R016 | 35 | GET | `/feedback/:id/edit` | FeedbackController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:35 |
| R017 | 35 | PUT|PATCH | `/feedback/:id` | FeedbackController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:35 |
| R018 | 36 | GET | `/feedback` | FeedbackController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:36 |
| R019 | 37 | POST | `/feedback/datatable` | FeedbackController.datatable | global+authSession | DATATABLE | - | - | routes.js:37 |
| R020 | 38 | POST | `/feedback/delete` | FeedbackController.delete | global+authSession | DELETE | - | - | routes.js:38 |
| R021 | 39 | POST | `/feedback/multidelete` | FeedbackController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:39 |
| R022 | 42 | PUT | `/order/:id/sync-status` | OrderController.syncStatus | global+authSession | AJAX_ACTION | - | - | routes.js:42 |
| R023 | 43 | GET | `/order` | OrderController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:43 |
| R024 | 43 | GET | `/order/:id/edit` | OrderController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:43 |
| R025 | 43 | PUT|PATCH | `/order/:id` | OrderController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:43 |
| R026 | 44 | POST | `/order/datatable` | OrderController.datatable | global+authSession | DATATABLE | - | - | routes.js:44 |
| R027 | 45 | DELETE | `/order` | OrderController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:45 |
| R028 | 48 | GET | `/notification` | NotificationController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Marketing,Superadmin | - | routes.js:48 |
| R029 | 48 | GET | `/notification/create` | NotificationController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:48 |
| R030 | 48 | POST | `/notification` | NotificationController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:48 |
| R031 | 48 | GET | `/notification/:id/edit` | NotificationController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:48 |
| R032 | 48 | PUT|PATCH | `/notification/:id` | NotificationController.update *(resource)* | global+authSession | AJAX_ACTION | - | - | routes.js:48 |
| R033 | 49 | GET | `/notification` | NotificationController.index | global+authSession | AUTHENTICATED_PAGE | Marketing,Superadmin | YES | routes.js:49 |
| R034 | 50 | POST | `/notification/datatable` | NotificationController.datatable | global+authSession | DATATABLE | - | - | routes.js:50 |
| R035 | 51 | POST | `/notification/cancel` | NotificationController.cancel | global+authSession | FORM_SUBMISSION | - | - | routes.js:51 |
| R036 | 52 | POST | `/notification/final` | NotificationController.final | global+authSession | FORM_SUBMISSION | - | - | routes.js:52 |
| R037 | 53 | POST | `/notification/delete` | NotificationController.delete | global+authSession | DELETE | - | - | routes.js:53 |
| R038 | 54 | POST | `/notification/save` | NotificationController.save | global+authSession | AJAX_ACTION | - | - | routes.js:54 |
| R039 | 55 | DELETE | `/notification` | NotificationController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:55 |
| R040 | 58 | GET | `/order-review` | OrderReviewController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:58 |
| R041 | 58 | GET | `/order-review/:id/edit` | OrderReviewController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:58 |
| R042 | 59 | GET | `/order-review` | OrderReviewController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:59 |
| R043 | 60 | POST | `/order-review/datatable` | OrderReviewController.datatable | global+authSession | DATATABLE | - | - | routes.js:60 |
| R044 | 61 | POST | `/order-review/delete` | OrderReviewController.delete | global+authSession | DELETE | - | - | routes.js:61 |
| R045 | 62 | POST | `/order-review/multidelete` | OrderReviewController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:62 |
| R046 | 65 | GET | `/global-configuration` | GlobalConfigurationController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:65 |
| R047 | 66 | POST | `/global-configuration/datatable` | GlobalConfigurationController.datatable | global+authSession | DATATABLE | - | - | routes.js:66 |
| R048 | 70 | POST | `/global-configuration/updatebyproductgposb2b` | GlobalConfigurationController.updateByProductGposb2b | global+authSession | FORM_SUBMISSION | - | - | routes.js:70 |
| R049 | 74 | POST | `/global-configuration/delete` | GlobalConfigurationController.delete | global+authSession | DELETE | - | - | routes.js:74 |
| R050 | 78 | POST | `/global-configuration/multidelete` | GlobalConfigurationController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:78 |
| R051 | 82 | GET | `/global-configuration` | GlobalConfigurationController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:82 |
| R052 | 82 | GET | `/global-configuration/create` | GlobalConfigurationController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:82 |
| R053 | 82 | POST | `/global-configuration` | GlobalConfigurationController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:82 |
| R054 | 82 | GET | `/global-configuration/:id/edit` | GlobalConfigurationController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:82 |
| R055 | 82 | PUT|PATCH | `/global-configuration/:id` | GlobalConfigurationController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:82 |
| R056 | 85 | GET | `/banner` | BannerController.index | global+authSession | AUTHENTICATED_PAGE | Marketing,Superadmin | - | routes.js:85 |
| R057 | 86 | POST | `/banner/datatable` | BannerController.datatable | global+authSession | DATATABLE | - | - | routes.js:86 |
| R058 | 87 | POST | `/banner/delete` | BannerController.delete | global+authSession | DELETE | - | - | routes.js:87 |
| R059 | 88 | POST | `/banner/multidelete` | BannerController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:88 |
| R060 | 89 | GET | `/banner/platform-options` | BannerController.getBannerPlatformOptions | global+authSession | OPTIONS | - | - | routes.js:89 |
| R061 | 93 | GET | `/banner/cust-id` | BannerController.getBannerCustIdOptions | global+authSession | OPTIONS | - | - | routes.js:93 |
| R062 | 94 | GET | `/banner/aam-cust-id` | BannerController.getBannerAamCustIdOptions | global+authSession | OPTIONS | - | - | routes.js:94 |
| R063 | 95 | GET | `/banner/channel-type` | BannerController.getBannerChannelTypeOptions | global+authSession | OPTIONS | - | - | routes.js:95 |
| R064 | 99 | GET | `/banner/branch` | BannerController.getBannerBranchOptions | global+authSession | OPTIONS | - | - | routes.js:99 |
| R065 | 100 | GET | `/banner` | BannerController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Marketing,Superadmin | YES | routes.js:100 |
| R066 | 100 | GET | `/banner/create` | BannerController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:100 |
| R067 | 100 | POST | `/banner` | BannerController.store *(resource)* | global+authSession | AJAX_ACTION | - | - | routes.js:100 |
| R068 | 100 | GET | `/banner/:id/edit` | BannerController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:100 |
| R069 | 100 | PUT|PATCH | `/banner/:id` | BannerController.update *(resource)* | global+authSession | AJAX_ACTION | - | - | routes.js:100 |
| R070 | 103 | POST | `/group-story/datatable` | GroupStoryController.datatable | global+authSession | DATATABLE | - | - | routes.js:103 |
| R071 | 104 | DELETE | `/group-story` | GroupStoryController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:104 |
| R072 | 105 | GET | `/group-story/available-banners` | GroupStoryController.getAvailableBanners | global+authSession | OTHER | - | - | routes.js:105 |
| R073 | 106 | GET | `/group-story` | GroupStoryController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:106 |
| R074 | 106 | GET | `/group-story/create` | GroupStoryController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:106 |
| R075 | 106 | POST | `/group-story` | GroupStoryController.store *(resource)* | global+authSession | AJAX_ACTION | - | - | routes.js:106 |
| R076 | 106 | GET | `/group-story/:id/edit` | GroupStoryController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:106 |
| R077 | 106 | PUT|PATCH | `/group-story/:id` | GroupStoryController.update *(resource)* | global+authSession | AJAX_ACTION | - | - | routes.js:106 |
| R078 | 106 | DELETE | `/group-story/:id` | GroupStoryController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:106 |
| R079 | 109 | GET | `/referral-code` | ReferralCodeController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:109 |
| R080 | 110 | GET | `/referral-code/datatable` | ReferralCodeController.datatable | global+authSession | DATATABLE | - | - | routes.js:110 |
| R081 | 111 | GET | `/referral-code/create` | ReferralCodeController.create | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:111 |
| R082 | 112 | POST | `/referral-code` | ReferralCodeController.store | global+authSession | FORM_SUBMISSION | - | - | routes.js:112 |
| R083 | 115 | DELETE | `/referral-code/:id` | ReferralCodeController.delete | global+authSession | DELETE | - | - | routes.js:115 |
| R084 | 116 | DELETE | `/referral-code` | ReferralCodeController.deleteBulk | global+authSession | MULTI_DELETE | - | - | routes.js:116 |
| R085 | 117 | GET | `/referral-code` | ReferralCodeController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:117 |
| R086 | 117 | GET | `/referral-code/create` | ReferralCodeController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | YES | routes.js:117 |
| R087 | 117 | POST | `/referral-code` | ReferralCodeController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | YES | routes.js:117 |
| R088 | 117 | GET | `/referral-code/:id/edit` | ReferralCodeController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:117 |
| R089 | 117 | PUT|PATCH | `/referral-code/:id` | ReferralCodeController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:117 |
| R090 | 120 | GET | `/custom-catalog` | CustomCatalogController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:120 |
| R091 | 121 | POST | `/custom-catalog/datatable` | CustomCatalogController.datatable | global+authSession | DATATABLE | - | - | routes.js:121 |
| R092 | 122 | POST | `/custom-catalog/delete` | CustomCatalogController.delete | global+authSession | DELETE | - | - | routes.js:122 |
| R093 | 123 | POST | `/custom-catalog/multidelete` | CustomCatalogController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:123 |
| R094 | 127 | GET | `/custom-catalogs/options` | CustomCatalogController.getCustomCatalogOptions | global+authSession | OPTIONS | - | - | routes.js:127 |
| R095 | 131 | GET | `/custom-catalog` | CustomCatalogController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:131 |
| R096 | 131 | GET | `/custom-catalog/create` | CustomCatalogController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:131 |
| R097 | 131 | POST | `/custom-catalog` | CustomCatalogController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:131 |
| R098 | 131 | GET | `/custom-catalog/:id/edit` | CustomCatalogController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:131 |
| R099 | 131 | PUT|PATCH | `/custom-catalog/:id` | CustomCatalogController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:131 |
| R100 | 134 | GET | `/custom-catalog-product-homepage` | CustomCatalogProductHomepageController.index | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:134 |
| R101 | 138 | POST | `/custom-catalog-product-homepage/datatable` | CustomCatalogProductHomepageController.datatable | global+authSession | DATATABLE | - | - | routes.js:138 |
| R102 | 142 | POST | `/custom-catalog-product-homepage/datatable_customcatalog/:id` | CustomCatalogProductHomepageController.datatableByCustomCatalogId | global+authSession | DATATABLE | - | - | routes.js:142 |
| R103 | 146 | POST | `/custom-catalog-product-homepage/delete` | CustomCatalogProductHomepageController.delete | global+authSession | DELETE | - | - | routes.js:146 |
| R104 | 150 | POST | `/custom-catalog-product-homepage/multidelete` | CustomCatalogProductHomepageController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:150 |
| R105 | 154 | GET | `/custom-catalog-product-homepage` | CustomCatalogProductHomepageController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | YES | routes.js:154 |
| R106 | 154 | GET | `/custom-catalog-product-homepage/create` | CustomCatalogProductHomepageController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:154 |
| R107 | 154 | POST | `/custom-catalog-product-homepage` | CustomCatalogProductHomepageController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:154 |
| R108 | 154 | GET | `/custom-catalog-product-homepage/:id/edit` | CustomCatalogProductHomepageController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:154 |
| R109 | 154 | PUT|PATCH | `/custom-catalog-product-homepage/:id` | CustomCatalogProductHomepageController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:154 |
| R110 | 160 | GET | `/product-gposb2b` | ProductGposb2bController.index *(resource)* | global+authSession | OTHER | Superadmin | - | routes.js:160 |
| R111 | 160 | GET | `/product-gposb2b/:id/edit` | ProductGposb2bController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:160 |
| R112 | 160 | PUT|PATCH | `/product-gposb2b/:id` | ProductGposb2bController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:160 |
| R113 | 161 | GET | `/product-gposb2b` | ProductGposb2bController.index | global+authSession | OTHER | Superadmin | YES | routes.js:161 |
| R114 | 164 | GET | `/product-gposb2b-homepage` | ProductGposb2bHomepageController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:164 |
| R115 | 164 | GET | `/product-gposb2b-homepage/create` | ProductGposb2bHomepageController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:164 |
| R116 | 164 | POST | `/product-gposb2b-homepage` | ProductGposb2bHomepageController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:164 |
| R117 | 164 | GET | `/product-gposb2b-homepage/:id/edit` | ProductGposb2bHomepageController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:164 |
| R118 | 164 | PUT|PATCH | `/product-gposb2b-homepage/:id` | ProductGposb2bHomepageController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:164 |
| R119 | 168 | GET | `/product-gposb2b-homepage` | ProductGposb2bHomepageController.index | global+authSession | AUTHENTICATED_PAGE | - | YES | routes.js:168 |
| R120 | 172 | POST | `/product-gposb2b-homepage/datatable` | ProductGposb2bHomepageController.datatable | global+authSession | DATATABLE | - | - | routes.js:172 |
| R121 | 176 | POST | `/product-gposb2b-homepage/delete` | ProductGposb2bHomepageController.delete | global+authSession | DELETE | - | - | routes.js:176 |
| R122 | 180 | POST | `/product-gposb2b-homepage/multidelete` | ProductGposb2bHomepageController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:180 |
| R123 | 186 | GET | `/custom-criteria` | CustomCriteriaController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:186 |
| R124 | 186 | GET | `/custom-criteria/create` | CustomCriteriaController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:186 |
| R125 | 186 | POST | `/custom-criteria` | CustomCriteriaController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:186 |
| R126 | 186 | GET | `/custom-criteria/:id/edit` | CustomCriteriaController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:186 |
| R127 | 187 | GET | `/custom-criteria` | CustomCriteriaController.index | global+authSession | AUTHENTICATED_PAGE | - | YES | routes.js:187 |
| R128 | 188 | POST | `/custom-criteria/update_by_custom_type/:type` | CustomCriteriaController.updateByCustomType | global+authSession | FORM_SUBMISSION | - | - | routes.js:188 |
| R129 | 192 | POST | `/custom-criteria/datatable` | CustomCriteriaController.datatable | global+authSession | DATATABLE | - | - | routes.js:192 |
| R130 | 193 | POST | `/custom-criteria/delete` | CustomCriteriaController.delete | global+authSession | DELETE | - | - | routes.js:193 |
| R131 | 194 | POST | `/custom-criteria/multidelete` | CustomCriteriaController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:194 |
| R132 | 200 | GET | `/content` | ContentController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:200 |
| R133 | 200 | GET | `/content/create` | ContentController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:200 |
| R134 | 200 | POST | `/content` | ContentController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:200 |
| R135 | 200 | GET | `/content/:id/edit` | ContentController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:200 |
| R136 | 200 | PUT|PATCH | `/content/:id` | ContentController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:200 |
| R137 | 201 | GET | `/content` | ContentController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:201 |
| R138 | 202 | POST | `/content/datatable` | ContentController.datatable | global+authSession | DATATABLE | - | - | routes.js:202 |
| R139 | 203 | POST | `/content/delete` | ContentController.delete | global+authSession | DELETE | - | - | routes.js:203 |
| R140 | 204 | POST | `/content/multidelete` | ContentController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:204 |
| R141 | 207 | POST | `/faqs/datatable` | FAQController.datatable | global+authSession | DATATABLE | - | - | routes.js:207 |
| R142 | 208 | DELETE | `/faqs` | FAQController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:208 |
| R143 | 209 | GET | `/faqs` | FAQController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:209 |
| R144 | 209 | GET | `/faqs/create` | FAQController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:209 |
| R145 | 209 | POST | `/faqs` | FAQController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:209 |
| R146 | 209 | GET | `/faqs/:id/edit` | FAQController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:209 |
| R147 | 209 | PUT|PATCH | `/faqs/:id` | FAQController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:209 |
| R148 | 209 | DELETE | `/faqs/:id` | FAQController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:209 |
| R149 | 212 | POST | `/products/datatable` | ProductController.datatable | global+authSession | DATATABLE | - | - | routes.js:212 |
| R150 | 213 | GET | `/products/search` | ProductController.searchProduct | global+authSession | MISSING-ACTION | - | - | routes.js:213 |
| R151 | 214 | GET | `/products/options` | ProductController.getProductOptions | global+authSession | OPTIONS | - | - | routes.js:214 |
| R152 | 215 | GET | `/products/lini-options` | ProductController.getProductLiniOptions | global+authSession | OPTIONS | - | - | routes.js:215 |
| R153 | 216 | GET | `/products/sublini-options` | ProductController.getProductSubliniOptions | global+authSession | OPTIONS | - | - | routes.js:216 |
| R154 | 217 | GET | `/products` | ProductController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:217 |
| R155 | 217 | GET | `/products/:id/edit` | ProductController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:217 |
| R156 | 217 | PUT|PATCH | `/products/:id` | ProductController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:217 |
| R157 | 220 | GET | `/product-category/options` | ProductCategoryController.getProductCategoryOptions | global+authSession | OPTIONS | - | - | routes.js:220 |
| R158 | 224 | POST | `/product-category/datatable` | ProductCategoryController.datatable | global+authSession | DATATABLE | - | - | routes.js:224 |
| R159 | 228 | DELETE | `/product-category` | ProductCategoryController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:228 |
| R160 | 229 | GET | `/product-category` | ProductCategoryController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:229 |
| R161 | 229 | GET | `/product-category/create` | ProductCategoryController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:229 |
| R162 | 229 | POST | `/product-category` | ProductCategoryController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:229 |
| R163 | 229 | GET | `/product-category/:id/edit` | ProductCategoryController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:229 |
| R164 | 229 | PUT|PATCH | `/product-category/:id` | ProductCategoryController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:229 |
| R165 | 229 | DELETE | `/product-category/:id` | ProductCategoryController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:229 |
| R166 | 232 | GET | `/catalog/options` | CatalogController.getCatalogOptions | global+authSession | OPTIONS | - | - | routes.js:232 |
| R167 | 236 | GET | `/poin-voucher/list` | PoinVoucherController.list | global+authSession | OTHER | - | - | routes.js:236 |
| R168 | 237 | GET | `/poin-voucher/setting-point/create-point/reguler` | PoinVoucherController.createPointReguler | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:237 |
| R169 | 241 | GET | `/poin-voucher/setting-point/create-point/payment/summary` | PoinVoucherController.createPointPaymentSummmary | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:241 |
| R170 | 245 | GET | `/poin-voucher/setting-point/create-point/payment` | PoinVoucherController.createPointPayment | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:245 |
| R171 | 249 | GET | `/poin-voucher/setting-point/create-point/bonus-point-program` | PoinVoucherController.createBonusPointProgram | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:249 |
| R172 | 253 | POST | `/poin-voucher/setting-point/create-point/bonus-point-program/summary` | PoinVoucherController.createBonusPointProgramSummary | global+authSession | AUTHENTICATED_PAGE(POST-rendered) | - | - | routes.js:253 |
| R173 | 257 | POST | `/poin-voucher/setting-point/create-point/bonus-point-program/summary/store` | PoinVoucherController.storeBonusPointProgramSummary | global+authSession | FORM_SUBMISSION | - | - | routes.js:257 |
| R174 | 263 | GET | `/poin-voucher/setting-point/edit-point/bonus-point-program/:id` | PoinVoucherController.editBonusPointProgram | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:263 |
| R175 | 267 | POST | `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary` | PoinVoucherController.editBonusPointProgramSummary | global+authSession | AUTHENTICATED_PAGE(POST-rendered) | - | - | routes.js:267 |
| R176 | 271 | POST | `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary/store` | PoinVoucherController.updateBonusPointProgramSummary | global+authSession | FORM_SUBMISSION | - | - | routes.js:271 |
| R177 | 276 | GET | `/poin-voucher/setting-point/create-point/folamil/summary` | PoinVoucherController.createPointFolamilSummary | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:276 |
| R178 | 280 | GET | `/poin-voucher/setting-point/create-point/folamil` | PoinVoucherController.createPointFolamil | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:280 |
| R179 | 285 | GET | `/poin-voucher/setting-point/create-point` | PoinVoucherController.createPoint | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:285 |
| R180 | 289 | GET | `/poin-voucher/setting-point` | PoinVoucherController.settingPoint | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:289 |
| R181 | 290 | POST | `/poin-voucher/setting-point/update-status` | PoinVoucherController.updateStatus | global+authSession | FORM_SUBMISSION | - | - | routes.js:290 |
| R182 | 295 | POST | `/poin-voucher/inject-point/datatable` | PoinVoucherController.injectPoinDatatable | global+authSession | DATATABLE | - | - | routes.js:295 |
| R183 | 299 | POST | `/poin-voucher/inject-point/create/summary` | PoinVoucherController.createInjectPointSummary | global+authSession | AUTHENTICATED_PAGE(POST-rendered) | - | - | routes.js:299 |
| R184 | 303 | POST | `/poin-voucher/inject-point/create/summary/store` | PoinVoucherController.storeInjectPointSummary | global+authSession | FORM_SUBMISSION | - | - | routes.js:303 |
| R185 | 307 | GET | `/poin-voucher/inject-point/create` | PoinVoucherController.createInjectPoint | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:307 |
| R186 | 311 | GET | `/poin-voucher/inject-point` | PoinVoucherController.injectPoint | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:311 |
| R187 | 312 | POST | `/poin-voucher/inject-point` | PoinVoucherController.multideleteInjectPoint | global+authSession | MULTI_DELETE | - | - | routes.js:312 |
| R188 | 316 | DELETE | `/poin-voucher/inject-point` | PoinVoucherController.deleteInjectPoint | global+authSession | DELETE | - | - | routes.js:316 |
| R189 | 321 | POST | `/poin-voucher/redeem/reguler/search` | MutasiRedeemPoinController.searchFilterReguler | global+authSession | MISSING-ACTION | - | - | routes.js:321 |
| R190 | 325 | GET | `/poin-voucher/redeem` | MutasiRedeemPoinController.redeemPoint | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:325 |
| R191 | 326 | GET | `/poin-voucher/redeem/point-types` | MutasiRedeemPoinController.getPointTypes | global+authSession | OPTIONS | - | - | routes.js:326 |
| R192 | 330 | POST | `/poin-voucher/redeem/reguler/datatable` | MutasiRedeemPoinController.datatable | global+authSession | DATATABLE | - | - | routes.js:330 |
| R193 | 335 | GET | `/poin-voucher` | PoinVoucherController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:335 |
| R194 | 335 | POST | `/poin-voucher` | PoinVoucherController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:335 |
| R195 | 338 | GET | `/voucher-setting/:code` | PoinVoucherSettingVoucherController.getByVoucherType | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:338 |
| R196 | 342 | GET | `/voucher-setting/:code/create-voucher` | PoinVoucherSettingVoucherController.createVoucher | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:342 |
| R197 | 346 | POST | `/voucher-setting/:code/create-voucher/summary` | PoinVoucherSettingVoucherController.createVoucherSummary | global+authSession | AUTHENTICATED_PAGE(POST-rendered) | - | - | routes.js:346 |
| R198 | 350 | POST | `/voucher-setting/:code/create-voucher/summary/store` | PoinVoucherSettingVoucherController.storeVoucher | global+authSession | FORM_SUBMISSION | - | - | routes.js:350 |
| R199 | 355 | GET | `/voucher-setting/:code/update-voucher/:id` | PoinVoucherSettingVoucherController.editVoucher | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:355 |
| R200 | 359 | POST | `/voucher-setting/:code/update-voucher/:id/summary` | PoinVoucherSettingVoucherController.editVoucherSummary | global+authSession | AUTHENTICATED_PAGE(POST-rendered) | - | - | routes.js:359 |
| R201 | 363 | POST | `/voucher-setting/:code/update-voucher/:id/summary/update` | PoinVoucherSettingVoucherController.updateVoucher | global+authSession | FORM_SUBMISSION | - | - | routes.js:363 |
| R202 | 368 | PUT | `/voucher-setting/:code/update-is-active/:id` | PoinVoucherSettingVoucherController.updateVoucherIsActive | global+authSession | AJAX_ACTION | - | - | routes.js:368 |
| R203 | 372 | GET | `/voucher-setting` | PoinVoucherSettingVoucherController.index | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:372 |
| R204 | 375 | POST | `/customer-groups/datatable` | CustomerGroupController.datatable | global+authSession | DATATABLE | - | - | routes.js:375 |
| R205 | 376 | DELETE | `/customer-groups` | CustomerGroupController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:376 |
| R206 | 377 | GET | `/customer-groups/search-product` | CustomerGroupController.searchProduct | global+authSession | SEARCH | - | - | routes.js:377 |
| R207 | 378 | GET | `/customer-groups/options` | CustomerGroupController.getOptions | global+authSession | OPTIONS | - | - | routes.js:378 |
| R208 | 379 | GET | `/customer-groups` | CustomerGroupController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:379 |
| R209 | 379 | GET | `/customer-groups/create` | CustomerGroupController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:379 |
| R210 | 379 | POST | `/customer-groups` | CustomerGroupController.store *(resource)* | global+authSession | AJAX_ACTION | - | - | routes.js:379 |
| R211 | 379 | GET | `/customer-groups/:id` | CustomerGroupController.show *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:379 |
| R212 | 379 | PUT|PATCH | `/customer-groups/:id` | CustomerGroupController.update *(resource)* | global+authSession | AJAX_ACTION | - | - | routes.js:379 |
| R213 | 379 | DELETE | `/customer-groups/:id` | CustomerGroupController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:379 |
| R214 | 382 | GET | `/product-class/options` | ProductClassController.getProductClassOptions | global+authSession | OPTIONS | - | - | routes.js:382 |
| R215 | 389 | GET | `/tc/options` | TcController.getTcOptions | global+authSession | OPTIONS | - | - | routes.js:389 |
| R216 | 390 | GET | `/tc/sub/options` | TcController.getSubTcOptions | global+authSession | OPTIONS | - | - | routes.js:390 |
| R217 | 394 | POST | `/inventories/datatable` | InventoryController.datatable | global+authSession | DATATABLE | - | - | routes.js:394 |
| R218 | 395 | DELETE | `/inventories` | InventoryController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:395 |
| R219 | 396 | GET | `/inventories/search-product` | InventoryController.searchProduct | global+authSession | SEARCH | - | - | routes.js:396 |
| R220 | 397 | GET | `/inventories` | InventoryController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:397 |
| R221 | 397 | GET | `/inventories/create` | InventoryController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:397 |
| R222 | 397 | POST | `/inventories` | InventoryController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:397 |
| R223 | 397 | GET | `/inventories/:id/edit` | InventoryController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:397 |
| R224 | 397 | PUT|PATCH | `/inventories/:id` | InventoryController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:397 |
| R225 | 397 | DELETE | `/inventories/:id` | InventoryController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:397 |
| R226 | 400 | POST | `/inventories/:inventoryId/inventory-stocks/datatable` | InventoryStockController.datatable | global+authSession | MISSING-ACTION | - | - | routes.js:400 |
| R227 | 404 | DELETE | `/inventories/:inventoryId/inventory-stocks` | InventoryStockController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:404 |
| R228 | 408 | POST | `/inventories/:inventoryId/inventory-stocks` | InventoryStockController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:408 |
| R229 | 408 | PUT|PATCH | `/inventories/:inventoryId/inventory-stocks/:id` | InventoryStockController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:408 |
| R230 | 408 | DELETE | `/inventories/:inventoryId/inventory-stocks/:id` | InventoryStockController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:408 |
| R231 | 414 | POST | `/sponsored-products/datatable` | SponsoredProductController.datatable | global+authSession | DATATABLE | - | - | routes.js:414 |
| R232 | 418 | DELETE | `/sponsored-products` | SponsoredProductController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:418 |
| R233 | 419 | GET | `/sponsored-products/search-product` | SponsoredProductController.searchProduct | global+authSession | MISSING-ACTION | - | - | routes.js:419 |
| R234 | 423 | GET | `/sponsored-products` | SponsoredProductController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:423 |
| R235 | 423 | GET | `/sponsored-products/create` | SponsoredProductController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:423 |
| R236 | 423 | POST | `/sponsored-products` | SponsoredProductController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:423 |
| R237 | 423 | GET | `/sponsored-products/:id/edit` | SponsoredProductController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:423 |
| R238 | 423 | PUT|PATCH | `/sponsored-products/:id` | SponsoredProductController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:423 |
| R239 | 423 | DELETE | `/sponsored-products/:id` | SponsoredProductController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:423 |
| R240 | 426 | GET | `/product-restrictions` | ProductRestrictedController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:426 |
| R241 | 427 | POST | `/product-restrictions/datatable` | ProductRestrictedController.datatable | global+authSession | DATATABLE | - | - | routes.js:427 |
| R242 | 431 | POST | `/product-restrictions/delete` | ProductRestrictedController.delete | global+authSession | DELETE | - | - | routes.js:431 |
| R243 | 435 | POST | `/product-restrictions/multidelete` | ProductRestrictedController.multidelete | global+authSession | MULTI_DELETE | - | - | routes.js:435 |
| R244 | 439 | GET | `/product-restrictions/channel-type` | ProductRestrictedController.channelTypeOptions | global+authSession | OPTIONS | - | - | routes.js:439 |
| R245 | 443 | GET | `/product-restrictions` | ProductRestrictedController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | YES | routes.js:443 |
| R246 | 443 | GET | `/product-restrictions/create` | ProductRestrictedController.create *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:443 |
| R247 | 443 | POST | `/product-restrictions` | ProductRestrictedController.store *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:443 |
| R248 | 443 | GET | `/product-restrictions/:id/edit` | ProductRestrictedController.edit *(resource)* | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:443 |
| R249 | 443 | PUT|PATCH | `/product-restrictions/:id` | ProductRestrictedController.update *(resource)* | global+authSession | FORM_SUBMISSION | - | - | routes.js:443 |
| R250 | 443 | DELETE | `/product-restrictions/:id` | ProductRestrictedController.destroy *(resource)* | global+authSession | DELETE | - | - | routes.js:443 |
| R251 | 446 | POST | `/files/signurl` | FileController.signURL | global+authSession | UPLOAD | - | - | routes.js:446 |
| R252 | 449 | GET | `/user-management` | UserManagementController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:449 |
| R253 | 450 | POST | `/user-management/datatable` | UserManagementController.datatable | global+authSession | DATATABLE | - | - | routes.js:450 |
| R254 | 451 | POST | `/user-management/delete` | UserManagementController.delete | global+authSession | DELETE | - | - | routes.js:451 |
| R255 | 452 | POST | `/user-management/:id/update-is-active` | UserManagementController.updateIsActive | global+authSession | AJAX_ACTION | - | - | routes.js:452 |
| R256 | 455 | GET | `/payment` | PaymentController.index | global+authSession | AUTHENTICATED_PAGE | Payment,Superadmin | - | routes.js:455 |
| R257 | 456 | GET | `/payment/:id` | PaymentController.detail | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:456 |
| R258 | 457 | POST | `/payment/datatable` | PaymentController.datatable | global+authSession | DATATABLE | - | - | routes.js:457 |
| R259 | 458 | POST | `/payment/:id` | PaymentController.postTriggerReceipt | global+authSession | FORM_SUBMISSION | - | - | routes.js:458 |
| R260 | 461 | GET | `/register-folamil` | RegisterFolamilController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:461 |
| R261 | 462 | POST | `/register-folamil` | RegisterFolamilController.store | global+authSession | FORM_SUBMISSION | - | - | routes.js:462 |
| R262 | 466 | GET | `/gamification` | GamificationController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:466 |
| R263 | 467 | GET | `/gamification/list` | GamificationController.list | global+authSession | OTHER | - | - | routes.js:467 |
| R264 | 468 | GET | `/gamification/create/type` | GamificationController.createType | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:468 |
| R265 | 469 | GET | `/gamification/create/single` | GamificationController.createSingle | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:469 |
| R266 | 470 | GET | `/gamification/create/multi` | GamificationController.createMulti | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:470 |
| R267 | 471 | POST | `/gamification` | GamificationController.store | global+authSession | AJAX_ACTION | - | - | routes.js:471 |
| R268 | 472 | GET | `/gamification/:id` | GamificationController.edit | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:472 |
| R269 | 473 | GET | `/gamification/:id/duplicate` | GamificationController.duplicate | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:473 |
| R270 | 474 | PUT | `/gamification/:id` | GamificationController.update | global+authSession | AJAX_ACTION | - | - | routes.js:474 |
| R271 | 475 | POST | `/gamification/:id/post-update` | GamificationController.postUpdate | global+authSession | FORM_SUBMISSION | - | - | routes.js:475 |
| R272 | 476 | POST | `/gamification/delete` | GamificationController.delete | global+authSession | DELETE | - | - | routes.js:476 |
| R273 | 477 | PUT | `/gamification/:id/update-status` | GamificationController.updateStatus | global+authSession | AJAX_ACTION | - | - | routes.js:477 |
| R274 | 478 | GET | `/gamification/options/mission-type` | GamificationController.getMissionTypeOptions | global+authSession | OPTIONS | - | - | routes.js:478 |
| R275 | 479 | GET | `/gamification/options/reward-type` | GamificationController.getRewardTypeOptions | global+authSession | OPTIONS | - | - | routes.js:479 |
| R276 | 480 | GET | `/gamification/options/price-type` | GamificationController.getPriceTypeOptions | global+authSession | OPTIONS | - | - | routes.js:480 |
| R277 | 481 | GET | `/gamification/options/channel-order` | GamificationController.getChannelOrderOptions | global+authSession | OPTIONS | - | - | routes.js:481 |
| R278 | 482 | GET | `/gamification/options/principal` | GamificationController.getPrincipalOptions | global+authSession | OPTIONS | - | - | routes.js:482 |
| R279 | 483 | GET | `/gamification/:id/generate-csv` | GamificationController.downloadGenerateCsv | global+authSession | DOWNLOAD | - | - | routes.js:483 |
| R280 | 484 | POST | `/gamification/upload-csv` | GamificationController.uploadCsv | global+authSession | UPLOAD | - | - | routes.js:484 |
| R281 | 485 | GET | `/gamification/:id/generate-csv-progress` | GamificationController.downloadGenerateCsvProgress | global+authSession | DOWNLOAD | - | - | routes.js:485 |
| R282 | 486 | POST | `/gamification/upload-csv-progress` | GamificationController.uploadCsvProgress | global+authSession | UPLOAD | - | - | routes.js:486 |
| R283 | 487 | GET | `/gamification/upload-csv-history/:id` | GamificationController.getUploadCsvHistory | global+authSession | UPLOAD | - | - | routes.js:487 |
| R284 | 491 | GET | `/gpos-brand/shipping-voucher` | GposBrandShippingVoucherController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:491 |
| R285 | 492 | GET | `/gpos-brand/shipping-voucher/create` | GposBrandShippingVoucherController.create | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:492 |
| R286 | 493 | POST | `/gpos-brand/shipping-voucher/datatable` | GposBrandShippingVoucherController.datatable | global+authSession | DATATABLE | - | - | routes.js:493 |
| R287 | 494 | POST | `/gpos-brand/shipping-voucher/submit` | GposBrandShippingVoucherController.submitVoucher | global+authSession | FORM_SUBMISSION | - | - | routes.js:494 |
| R288 | 495 | GET | `/gpos-brand/shipping-voucher/:id/cancel` | GposBrandShippingVoucherController.cancelVoucher | global+authSession | REDIRECT | - | - | routes.js:495 |
| R289 | 497 | POST | `/gpos-brand/datatable` | GposBrandController.datatable | global+authSession | DATATABLE | - | - | routes.js:497 |
| R290 | 498 | GET | `/gpos-brand/detail-pesanan/:id` | GposBrandController.detailPesanan | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:498 |
| R291 | 499 | POST | `/gpos-brand/:id/update-shipment-fee` | GposBrandController.updateShipmentFee | global+authSession | FORM_SUBMISSION | - | - | routes.js:499 |
| R292 | 500 | POST | `/gpos-brand/:id/update-shipment-detail` | GposBrandController.updateShipmentDetail | global+authSession | FORM_SUBMISSION | - | - | routes.js:500 |
| R293 | 501 | POST | `/gpos-brand/:id/update-status-to-canceled` | GposBrandController.updateStatusToCanceled | global+authSession | FORM_SUBMISSION | - | - | routes.js:501 |
| R294 | 502 | GET | `/gpos-brand` | GposBrandController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:502 |
| R295 | 505 | GET | `/loyalty-member/:id` | LoyaltyMemberController.programByPrincipalList | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:505 |
| R296 | 506 | GET | `/loyalty-member/:id/list` | LoyaltyMemberController.programByPrincipalDataTable | global+authSession | DATATABLE | - | - | routes.js:506 |
| R297 | 508 | GET | `/loyalty-member/:id/voucher` | LoyaltyMemberController.createProgramDetailByPrincipal | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:508 |
| R298 | 509 | POST | `/loyalty-member/:id/voucher` | LoyaltyMemberController.storeProgramDetailByPrincipal | global+authSession | FORM_SUBMISSION | - | - | routes.js:509 |
| R299 | 510 | GET | `/loyalty-member/:id/point` | LoyaltyMemberController.createProgramDetailByPrincipal | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:510 |
| R300 | 511 | POST | `/loyalty-member/:id/point` | LoyaltyMemberController.storeProgramDetailByPrincipal | global+authSession | FORM_SUBMISSION | - | - | routes.js:511 |
| R301 | 512 | POST | `/loyalty-member/:id/update` | LoyaltyMemberController.putProgramDetailByPrincipal | global+authSession | FORM_SUBMISSION | - | - | routes.js:512 |
| R302 | 513 | GET | `/loyalty-member/:id/:program/:type` | LoyaltyMemberController.programDetailByPrincipal | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:513 |
| R303 | 520 | POST | `/loyalty-member/card` | LoyaltyMemberController.storeCard | global+authSession | FORM_SUBMISSION | - | - | routes.js:520 |
| R304 | 521 | POST | `/loyalty-member/generate-csv` | LoyaltyMemberController.generateCardCsv | global+authSession | DOWNLOAD | - | - | routes.js:521 |
| R305 | 522 | POST | `/loyalty-member/validate-branch-csv` | LoyaltyMemberController.validateBranchCsv | global+authSession | DOWNLOAD | - | - | routes.js:522 |
| R306 | 523 | POST | `/loyalty-member/card/:id` | LoyaltyMemberController.putCard | global+authSession | FORM_SUBMISSION | - | - | routes.js:523 |
| R307 | 524 | GET | `/loyalty-member` | LoyaltyMemberController.index *(resource)* | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:524 |
| R308 | 527 | GET | `/user-verification` | UserVerificationController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:527 |
| R309 | 528 | POST | `/user-verification/datatable` | UserVerificationController.datatable | global+authSession | DATATABLE | - | - | routes.js:528 |
| R310 | 529 | GET | `/user-verification/:id/detail` | UserVerificationController.detail | global+authSession | OTHER | - | - | routes.js:529 |
| R311 | 530 | POST | `/user-verification/:id/reject` | UserVerificationController.reject | global+authSession | AJAX_ACTION | - | - | routes.js:530 |
| R312 | 531 | POST | `/user-verification/:id/approve` | UserVerificationController.approve | global+authSession | AJAX_ACTION | - | - | routes.js:531 |
| R313 | 532 | POST | `/user-verification/:id/update` | UserVerificationController.update | global+authSession | AJAX_ACTION | - | - | routes.js:532 |
| R314 | 536 | GET | `/personalization/channels` | PersonalizationChannelController.index | global+authSession | AUTHENTICATED_PAGE | Superadmin | - | routes.js:536 |
| R315 | 537 | GET | `/personalization/channels/list-options` | PersonalizationChannelController.listOptions | global+authSession | OPTIONS | - | - | routes.js:537 |
| R316 | 538 | GET | `/personalization/channels/customers/list-options` | PersonalizationChannelController.CustomersListOptionsController | global+authSession | OPTIONS | - | - | routes.js:538 |
| R317 | 539 | POST | `/personalization/channels/customers-validate` | PersonalizationChannelController.CustomersValidateController | global+authSession | FORM_SUBMISSION | - | - | routes.js:539 |
| R318 | 540 | GET | `/personalization/channels/:id/product-categories/list-options` | PersonalizationChannelController.ProductCategoriesListOptionsController | global+authSession | OPTIONS | - | - | routes.js:540 |
| R319 | 541 | GET | `/personalization/channels/:id/principals/list-options` | PersonalizationChannelController.PrincipalListOptionsController | global+authSession | OPTIONS | - | - | routes.js:541 |
| R320 | 542 | GET | `/personalization/channels/products/list-options` | PersonalizationChannelController.getProductListOptionsController | global+authSession | OPTIONS | - | - | routes.js:542 |
| R321 | 543 | GET | `/personalization/channels/products/:id` | PersonalizationChannelController.getProductDetail | global+authSession | REDIRECT | - | - | routes.js:543 |
| R322 | 544 | DELETE | `/personalization/channels/products/bulk` | PersonalizationChannelController.deleteProductBulk | global+authSession | MULTI_DELETE | - | - | routes.js:544 |
| R323 | 545 | DELETE | `/personalization/channels/products/:id` | PersonalizationChannelController.deleteProduct | global+authSession | DELETE | - | - | routes.js:545 |
| R324 | 546 | POST | `/personalization/channels/datatable` | PersonalizationChannelController.datatable | global+authSession | DATATABLE | - | - | routes.js:546 |
| R325 | 547 | POST | `/personalization/channels/:id/products/datatable` | PersonalizationChannelController.datatableProduct | global+authSession | DATATABLE | - | - | routes.js:547 |
| R326 | 548 | POST | `/personalization/channels/:id/products/save` | PersonalizationChannelController.saveProduct | global+authSession | FORM_SUBMISSION | - | - | routes.js:548 |
| R327 | 549 | POST | `/personalization/channels/create` | PersonalizationChannelController.createPersonalizationChannel | global+authSession | FORM_SUBMISSION | - | - | routes.js:549 |
| R328 | 550 | GET | `/personalization/channels/:id` | PersonalizationChannelController.createPage | global+authSession | AUTHENTICATED_PAGE | - | - | routes.js:550 |
| R329 | 551 | POST | `/personalization/channels/:id` | PersonalizationChannelController.update | global+authSession | AJAX_ACTION | - | - | routes.js:551 |
| R330 | 552 | DELETE | `/personalization/channels/:id` | PersonalizationChannelController.deleteChannelController | global+authSession | DELETE | - | - | routes.js:552 |

### 3.3 Resource-derived routes with no controller action (97) — not user-facing unless linked

| Controller | Missing resource actions |
|---|---|
| PrincipalController | show, destroy |
| FeedbackController | create, store, show, destroy |
| OrderController | create, store, show, destroy |
| NotificationController | show, destroy |
| OrderReviewController | create, store, show, update, destroy |
| GlobalConfigurationController | show, destroy |
| BannerController | show, destroy |
| GroupStoryController | show |
| ReferralCodeController | show, destroy |
| CustomCatalogController | show, destroy |
| CustomCatalogProductHomepageController | show, destroy |
| ProductGposb2bController | create, store, show, destroy |
| ProductGposb2bHomepageController | show, destroy |
| CustomCriteriaController | show, update, destroy |
| ContentController | show, destroy |
| FAQController | show |
| ProductController | create, store, show, destroy |
| ProductCategoryController | show |
| CatalogController | index, create, store, show, edit, update, destroy |
| PoinVoucherController | create, show, edit, update, destroy |
| CustomerGroupController | edit |
| ProductClassController | index, create, store, show, edit, update, destroy |
| TcController | index, create, store, show, edit, update, destroy |
| InventoryController | show |
| InventoryStockController | index, create, show, edit |
| SponsoredProductController | show |
| ProductRestrictedController | show |
| UserManagementController | create, store, show, edit, update, destroy |
| GposBrandController | create, store, show, edit, update, destroy |
| LoyaltyMemberController | create, store, show, edit, update, destroy |

---

## 4. Route → Screen Mapping (A1.2)

There is one row per route that renders a view. The screen type follows the view name: `list`, `create`, `edit`, `detail`, `summary` or `index`. When a controller's `checkAuth` fails, it renders `login` in place of the page. That fallback is recorded as behavior (§15, §18), not as a screen.

**Mappings that are not obvious:**

| Route | What it actually renders |
|---|---|
| `GET /product-gposb2b` | Delegates to `edit()`, so S107 and S032 are the same tabbed page |
| `GET /customer-groups/:id` (show) | The edit page |
| `GET /gpos-brand/detail-pesanan/:id` | `gpos_brand/create`, which is the order detail/processing screen |
| `GET /gamification/:id` and `/:id/duplicate` | Both render `gamification/edit` (the `isDuplicate` flag differs) |
| `GET /loyalty-member/:id/voucher` and `/:id/point` | Both render `detail-program/create` (`programType` is `voucher` or `points`) |
| `POST …/summary` routes | Wizard summary pages rendered from a POST (5 screens) |

| Screen ID | Method | URL | Controller.action | View | Layout | Partials/Components (closure) | Menu | Evidence |
|---|---|---|---|---|---|---|---|---|
| S001 | GET | `/home` | HomeController.home | dashboard | layouts | - | Payment(hidden),Marketing(hidden),Superadmin | ctrl.json |
| S002 | GET | `/principal` | PrincipalController.index | principals/list | layouts | - | Superadmin | ctrl.json |
| S003 | GET | `/principal/create` | PrincipalController.create | principals/create | layouts | - | - | ctrl.json |
| S004 | GET | `/principal/:id/edit` | PrincipalController.edit | principals/edit | layouts | - | - | ctrl.json |
| S005 | GET | `/feedback` | FeedbackController.index | feedbacks/list | layouts | - | Superadmin | ctrl.json |
| S006 | GET | `/feedback/:id/edit` | FeedbackController.edit | feedbacks/edit | layouts | - | - | ctrl.json |
| S007 | GET | `/order` | OrderController.index | orders/list | layouts | c:form_text, c:form_select_multiple, c:form_select | Superadmin | ctrl.json |
| S008 | GET | `/order/:id/edit` | OrderController.edit | orders/edit | layouts | - | - | ctrl.json |
| S009 | GET | `/notification` | NotificationController.index | notifications/list | layouts | - | Marketing,Superadmin | ctrl.json |
| S010 | GET | `/notification/create` | NotificationController.create | notifications/create | layouts | notifications/tabs/notification_setting_create, c:form_text, c:form_image, c:form_select_multiple, c:form_textarea, notifications/tabs/notification_relation_create, notifications/tabs/notification_schedule_create, c:form_select, c:form_radio, c:form_date, c:form_timepicker, notifications/tabs/notification_preview, includes/script_image_uploader | - | ctrl.json |
| S011 | GET | `/notification/:id/edit` | NotificationController.edit | notifications/edit | layouts | notifications/tabs/notification_setting_edit, c:form_text, c:form_image, c:form_select_multiple, c:form_textarea, notifications/tabs/notification_relation_edit, notifications/tabs/notification_schedule_edit, c:form_select, c:form_radio, c:form_date, c:form_timepicker, notifications/tabs/notification_preview, includes/script_image_uploader | - | ctrl.json |
| S012 | GET | `/order-review` | OrderReviewController.index | order_reviews/list | layouts | - | Superadmin | ctrl.json |
| S013 | GET | `/order-review/:id/edit` | OrderReviewController.edit | order_reviews/edit | layouts | - | - | ctrl.json |
| S014 | GET | `/global-configuration` | GlobalConfigurationController.index | global_configurations/list | layouts | - | Superadmin | ctrl.json |
| S015 | GET | `/global-configuration/create` | GlobalConfigurationController.create | global_configurations/create | layouts | c:form_text | - | ctrl.json |
| S016 | GET | `/global-configuration/:id/edit` | GlobalConfigurationController.edit | global_configurations/edit | layouts | c:form_text | - | ctrl.json |
| S017 | GET | `/banner` | BannerController.index | banners/list | layouts | - | Marketing,Superadmin | ctrl.json |
| S018 | GET | `/banner/create` | BannerController.create | banners/create | layouts | banners/tabs/banner_create, c:form_toggle_switch, c:form_select, c:form_image, c:form_text, c:form_number, c:form_select_multiple, c:form_url, c:form_date, c:form_texteditor_quill, c:form_textarea, includes/script_image_uploader | - | ctrl.json |
| S019 | GET | `/banner/:id/edit` | BannerController.edit | banners/edit | layouts | banners/tabs/banner_edit, c:form_toggle_switch, c:form_select, c:form_image, c:form_text, c:form_number, c:form_select_multiple, c:form_url, c:form_date, c:form_texteditor_quill, c:form_textarea, banners/tabs/banner_criteria, includes/script_image_uploader | - | ctrl.json |
| S020 | GET | `/group-story` | GroupStoryController.index | group_story/list | layouts | - | Superadmin | ctrl.json |
| S021 | GET | `/group-story/create` | GroupStoryController.create | group_story/create | layouts | includes/script_image_uploader, c:form_toggle_switch, c:form_text, c:form_image, c:form_number, c:form_date, c:form_text_icon | - | ctrl.json |
| S022 | GET | `/group-story/:id/edit` | GroupStoryController.edit | group_story/edit | layouts | includes/script_image_uploader, c:form_toggle_switch, c:form_text, c:form_image, c:form_number, c:form_date, c:form_text_icon | - | ctrl.json |
| S023 | GET | `/referral-code` | ReferralCodeController.index | referral_code/list | layouts | - | Superadmin | ctrl.json |
| S024 | GET | `/referral-code/create` | ReferralCodeController.create | referral_code/create | layouts | referral_code/tab/setting-telesales-code, c:form_toggle_switch, c:form_text, c:form_number, referral_code/tab/setting-transaction-channel, c:form_select_multiple, c:form_textarea | - | ctrl.json |
| S025 | GET | `/referral-code/:id/edit` | ReferralCodeController.edit | referral_code/edit | layouts | referral_code/tab/setting-telesales-code, c:form_toggle_switch, c:form_text, c:form_number, referral_code/tab/setting-transaction-channel, c:form_select_multiple, c:form_textarea | - | ctrl.json |
| S026 | GET | `/custom-catalog` | CustomCatalogController.index | custom_catalogs/list | layouts | - | Superadmin | ctrl.json |
| S027 | GET | `/custom-catalog/create` | CustomCatalogController.create | custom_catalogs/create | layouts | custom_catalogs/tabs/custom_catalog_create, c:form_text, c:form_number | - | ctrl.json |
| S028 | GET | `/custom-catalog/:id/edit` | CustomCatalogController.edit | custom_catalogs/edit | layouts | custom_catalogs/tabs/custom_catalog_edit, c:form_text, c:form_number, custom_catalogs/tabs/custom_catalog_product_homepage, c:form_select2_custom, custom_catalogs/tabs/custom_criteria, c:form_select_multiple | - | ctrl.json |
| S029 | GET | `/custom-catalog-product-homepage` | CustomCatalogProductHomepageController.index | custom_catalog_product_homepages/list | layouts | - | - | ctrl.json |
| S030 | GET | `/custom-catalog-product-homepage/create` | CustomCatalogProductHomepageController.create | custom_catalog_product_homepages/create | layouts | c:form_select2_custom | - | ctrl.json |
| S031 | GET | `/custom-catalog-product-homepage/:id/edit` | CustomCatalogProductHomepageController.edit | custom_catalog_product_homepages/edit | layouts | c:form_text, c:form_number | - | ctrl.json |
| S032 | GET | `/product-gposb2b/:id/edit` | ProductGposb2bController.edit | product_gposb2bs/edit | layouts | product_gposb2bs/tabs/product_gposb2b, c:form_text, c:form_image, product_gposb2bs/tabs/product_gposb2b_homepage, c:form_select2_custom, c:form_number, product_gposb2bs/tabs/product_gposb2b_criteria, c:form_select_multiple, includes/script_image_uploader | - | ctrl.json |
| S033 | GET | `/product-gposb2b-homepage` | ProductGposb2bHomepageController.index | **product_gposb2b_homepages/list (MISSING)** | - | - | - | ctrl.json |
| S034 | GET | `/product-gposb2b-homepage/create` | ProductGposb2bHomepageController.create | **product_gposb2b_homepages/create (MISSING)** | - | - | - | ctrl.json |
| S035 | GET | `/product-gposb2b-homepage/:id/edit` | ProductGposb2bHomepageController.edit | **product_gposb2b_homepages/edit (MISSING)** | - | - | - | ctrl.json |
| S036 | GET | `/custom-criteria` | CustomCriteriaController.index | custom_catalog_criterias/list | layouts | - | - | ctrl.json |
| S037 | GET | `/custom-criteria/create` | CustomCriteriaController.create | custom_catalog_criterias/create | layouts | c:form_select2_custom | - | ctrl.json |
| S038 | GET | `/custom-criteria/:id/edit` | CustomCriteriaController.edit | custom_catalog_criterias/edit | layouts | - | - | ctrl.json |
| S039 | GET | `/content` | ContentController.index | contents/list | layouts | - | Superadmin | ctrl.json |
| S040 | GET | `/content/create` | ContentController.create | contents/create | layouts | - | - | ctrl.json |
| S041 | GET | `/content/:id/edit` | ContentController.edit | contents/edit | layouts | - | - | ctrl.json |
| S042 | GET | `/faqs` | FAQController.index | faqs/list | layouts | - | Superadmin | ctrl.json |
| S043 | GET | `/faqs/create` | FAQController.create | faqs/create | layouts | c:form_select, c:form_text, c:form_textarea | - | ctrl.json |
| S044 | GET | `/faqs/:id/edit` | FAQController.edit | faqs/edit | layouts | c:form_select, c:form_text, c:form_textarea | - | ctrl.json |
| S045 | GET | `/products` | ProductController.index | products/list | layouts | - | Superadmin | ctrl.json |
| S046 | GET | `/products/:id/edit` | ProductController.edit | products/edit | layouts | includes/script_image_uploader, c:form_image, c:form_text, c:form_textarea, c:form_select | - | ctrl.json |
| S047 | GET | `/product-category` | ProductCategoryController.index | product_category/list | layouts | - | Superadmin | ctrl.json |
| S048 | GET | `/product-category/create` | ProductCategoryController.create | product_category/create | layouts | includes/script_image_uploader, c:form_text, c:form_image | - | ctrl.json |
| S049 | GET | `/product-category/:id/edit` | ProductCategoryController.edit | product_category/edit | layouts | includes/script_image_uploader, c:form_text, c:form_image | - | ctrl.json |
| S050 | GET | `/poin-voucher/setting-point/create-point/reguler` | PoinVoucherController.createPointReguler | poin_voucher/setting_point/create_point_reguler | layouts | c:form_toggle_switch | - | ctrl.json |
| S051 | GET | `/poin-voucher/setting-point/create-point/payment/summary` | PoinVoucherController.createPointPaymentSummmary | poin_voucher/setting_point/create_point_payment_summary | layouts | - | - | ctrl.json |
| S052 | GET | `/poin-voucher/setting-point/create-point/payment` | PoinVoucherController.createPointPayment | poin_voucher/setting_point/create_point_payment | layouts | c:form_toggle_switch | - | ctrl.json |
| S053 | GET | `/poin-voucher/setting-point/create-point/bonus-point-program` | PoinVoucherController.createBonusPointProgram | poin_voucher/setting_point/create_bonus_point_program | layouts | poin_voucher/setting_point/program/single_item, c:form_select, c:form_number, c:form_select2_custom, c:form_select_multiple, c:form_datetimepicker, c:form_textarea, c:form_toggle_switch, poin_voucher/setting_point/program/combination_or, poin_voucher/setting_point/program/combination_and, poin_voucher/setting_point/program/multi_level_program, c:form_date, c:form_text | - | ctrl.json |
| S054 | POST | `/poin-voucher/setting-point/create-point/bonus-point-program/summary` | PoinVoucherController.createBonusPointProgramSummary | poin_voucher/setting_point/create_bonus_point_program_summary | layouts | - | - | ctrl.json |
| S055 | GET | `/poin-voucher/setting-point/edit-point/bonus-point-program/:id` | PoinVoucherController.editBonusPointProgram | poin_voucher/setting_point/edit_bonus_point_program | layouts | poin_voucher/setting_point/program/single_item, c:form_select, c:form_number, c:form_select2_custom, c:form_select_multiple, c:form_datetimepicker, c:form_textarea, c:form_toggle_switch, poin_voucher/setting_point/program/combination_or, poin_voucher/setting_point/program/combination_and, poin_voucher/setting_point/program/multi_level_program, c:form_date, poin_voucher/setting_point/program/regular, c:form_text, poin_voucher/setting_point/program/pembayaran, poin_voucher/setting_point/program/folamil | - | ctrl.json |
| S056 | POST | `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary` | PoinVoucherController.editBonusPointProgramSummary | poin_voucher/setting_point/edit_bonus_point_program_summary | layouts | - | - | ctrl.json |
| S057 | GET | `/poin-voucher/setting-point/create-point/folamil/summary` | PoinVoucherController.createPointFolamilSummary | poin_voucher/setting_point/create_point_folamil_summary | layouts | - | - | ctrl.json |
| S058 | GET | `/poin-voucher/setting-point/create-point/folamil` | PoinVoucherController.createPointFolamil | poin_voucher/setting_point/create_point_folamil | layouts | c:form_toggle_switch | - | ctrl.json |
| S059 | GET | `/poin-voucher/setting-point/create-point` | PoinVoucherController.createPoint | poin_voucher/setting_point/create_point | layouts | - | - | ctrl.json |
| S060 | GET | `/poin-voucher/setting-point` | PoinVoucherController.settingPoint | poin_voucher/setting_point/index | layouts | - | - | ctrl.json |
| S061 | POST | `/poin-voucher/inject-point/create/summary` | PoinVoucherController.createInjectPointSummary | poin_voucher/inject_point/create_summary | layouts | - | - | ctrl.json |
| S062 | GET | `/poin-voucher/inject-point/create` | PoinVoucherController.createInjectPoint | poin_voucher/inject_point/create | layouts | c:form_select2_custom, c:form_number, c:form_text, c:form_date, c:form_select | - | ctrl.json |
| S063 | GET | `/poin-voucher/inject-point` | PoinVoucherController.injectPoint | poin_voucher/inject_point/list | layouts | - | - | ctrl.json |
| S064 | GET | `/poin-voucher/redeem` | MutasiRedeemPoinController.redeemPoint | poin_voucher/mutasi_redeem/filter | layouts | poin_voucher/mutasi_redeem/tabs/search, c:form_text, c:form_select_multiple, c:form_date, c:form_select | - | ctrl.json |
| S065 | GET | `/poin-voucher` | PoinVoucherController.index | poin_voucher/list | layouts | - | Superadmin | ctrl.json |
| S066 | GET | `/voucher-setting/:code` | PoinVoucherSettingVoucherController.getByVoucherType | poin_voucher/voucher_setting/voucher_category_view | layouts | - | - | ctrl.json |
| S067 | GET | `/voucher-setting/:code/create-voucher` | PoinVoucherSettingVoucherController.createVoucher | poin_voucher/voucher_setting/voucher_category/create | layouts | includes/script_image_uploader, c:form_text, c:form_select, c:form_number, c:form_toggle_switch | - | ctrl.json |
| S068 | POST | `/voucher-setting/:code/create-voucher/summary` | PoinVoucherSettingVoucherController.createVoucherSummary | poin_voucher/voucher_setting/voucher_category/create_summary | layouts | - | - | ctrl.json |
| S069 | GET | `/voucher-setting/:code/update-voucher/:id` | PoinVoucherSettingVoucherController.editVoucher | poin_voucher/voucher_setting/voucher_category/edit | layouts | includes/script_image_uploader, c:form_text, c:form_select, c:form_number, c:form_toggle_switch | - | ctrl.json |
| S070 | POST | `/voucher-setting/:code/update-voucher/:id/summary` | PoinVoucherSettingVoucherController.editVoucherSummary | poin_voucher/voucher_setting/voucher_category/edit_summary | layouts | - | - | ctrl.json |
| S071 | GET | `/voucher-setting` | PoinVoucherSettingVoucherController.index | poin_voucher/voucher_setting/list | layouts | - | - | ctrl.json |
| S072 | GET | `/customer-groups` | CustomerGroupController.index | customer_group/list | layouts | - | Superadmin | ctrl.json |
| S073 | GET | `/customer-groups/create` | CustomerGroupController.create | customer_group/create | layouts | - | - | ctrl.json |
| S074 | GET | `/customer-groups/:id` | CustomerGroupController.show | customer_group/create | layouts | - | - | ctrl.json |
| S075 | GET | `/inventories` | InventoryController.index | inventories/list | layouts | - | Superadmin | ctrl.json |
| S076 | GET | `/inventories/create` | InventoryController.create | inventories/create | layouts | c:form_select2, c:form_select, c:form_text | - | ctrl.json |
| S077 | GET | `/inventories/:id/edit` | InventoryController.edit | inventories/edit | layouts | inventories/inventory-stock-modal, c:form_text, c:form_date, c:form_select | - | ctrl.json |
| S078 | GET | `/sponsored-products` | SponsoredProductController.index | sponsored_products/list | layouts | - | Superadmin | ctrl.json |
| S079 | GET | `/sponsored-products/create` | SponsoredProductController.create | sponsored_products/create | layouts | c:form_select, c:form_select2, c:form_text | - | ctrl.json |
| S080 | GET | `/sponsored-products/:id/edit` | SponsoredProductController.edit | sponsored_products/edit | layouts | c:form_select, c:form_select2, c:form_text | - | ctrl.json |
| S081 | GET | `/product-restrictions` | ProductRestrictedController.index | product_restrictions/list | layouts | - | Superadmin | ctrl.json |
| S082 | GET | `/product-restrictions/create` | ProductRestrictedController.create | product_restrictions/create | layouts | c:form_select2, c:form_select_multiple | - | ctrl.json |
| S083 | GET | `/product-restrictions/:id/edit` | ProductRestrictedController.edit | product_restrictions/edit | layouts | c:form_text, c:form_select_multiple | - | ctrl.json |
| S084 | GET | `/user-management` | UserManagementController.index | user_management/list | layouts | c:form_select_multiple | Superadmin | ctrl.json |
| S085 | GET | `/payment` | PaymentController.index | payment/list | layouts | payment/tabs/search, c:form_date, c:form_select_multiple | Payment,Superadmin | ctrl.json |
| S086 | GET | `/payment/:id` | PaymentController.detail | payment/detail | layouts | - | - | ctrl.json |
| S087 | GET | `/register-folamil` | RegisterFolamilController.index | register_folamil/index | layouts | includes/script_image_uploader, c:form_image | Superadmin | ctrl.json |
| S088 | GET | `/gamification` | GamificationController.index | gamification/index | layouts | gamification/c:confirm-cancel-active-mission-modal, gamification/c:confirm-erase-mission-modal | Superadmin | ctrl.json |
| S089 | GET | `/gamification/create/type` | GamificationController.createType | gamification/create_type | layouts | - | - | ctrl.json |
| S090 | GET | `/gamification/create/single` | GamificationController.createSingle | gamification/create | layouts | gamification/tabs/setting_create, c:form_text, c:form_toggle_switch, c:form_select_multiple, c:form_select, c:form_image, c:form_textarea, c:form_number, gamification/tabs/multi_timeline_create, c:form_date, gamification/tabs/single_timeline_create, gamification/tabs/reward_create, gamification/tabs/target_create, gamification/c:voucher-reward-modal, gamification/c:physical-reward-modal, gamification/c:confirm-cancel-mission-modal, gamification/c:confirm-reward-at-start-modal, includes/script_image_uploader | - | ctrl.json |
| S091 | GET | `/gamification/create/multi` | GamificationController.createMulti | gamification/create | layouts | gamification/tabs/setting_create, c:form_text, c:form_toggle_switch, c:form_select_multiple, c:form_select, c:form_image, c:form_textarea, c:form_number, gamification/tabs/multi_timeline_create, c:form_date, gamification/tabs/single_timeline_create, gamification/tabs/reward_create, gamification/tabs/target_create, gamification/c:voucher-reward-modal, gamification/c:physical-reward-modal, gamification/c:confirm-cancel-mission-modal, gamification/c:confirm-reward-at-start-modal, includes/script_image_uploader | - | ctrl.json |
| S092 | GET | `/gamification/:id` | GamificationController.edit | gamification/edit | layouts | gamification/tabs/setting_create, c:form_text, c:form_toggle_switch, c:form_select_multiple, c:form_select, c:form_image, c:form_textarea, c:form_number, gamification/tabs/multi_timeline_create, c:form_date, gamification/tabs/single_timeline_create, gamification/tabs/reward_create, gamification/tabs/target_create, gamification/c:voucher-reward-modal, gamification/c:physical-reward-modal, gamification/c:confirm-cancel-mission-modal, gamification/c:confirm-reward-at-start-modal, gamification/c:confirm-save-and-activate-mission-modal, gamification/c:confirm-erase-mission-modal, gamification/c:required-fields-modal, includes/script_image_uploader | - | ctrl.json |
| S093 | GET | `/gamification/:id/duplicate` | GamificationController.duplicate | gamification/edit | layouts | gamification/tabs/setting_create, c:form_text, c:form_toggle_switch, c:form_select_multiple, c:form_select, c:form_image, c:form_textarea, c:form_number, gamification/tabs/multi_timeline_create, c:form_date, gamification/tabs/single_timeline_create, gamification/tabs/reward_create, gamification/tabs/target_create, gamification/c:voucher-reward-modal, gamification/c:physical-reward-modal, gamification/c:confirm-cancel-mission-modal, gamification/c:confirm-reward-at-start-modal, gamification/c:confirm-save-and-activate-mission-modal, gamification/c:confirm-erase-mission-modal, gamification/c:required-fields-modal, includes/script_image_uploader | - | ctrl.json |
| S094 | GET | `/gpos-brand/shipping-voucher` | GposBrandShippingVoucherController.index | gpos_brand/shipping_voucher/list | layouts | - | Superadmin | ctrl.json |
| S095 | GET | `/gpos-brand/shipping-voucher/create` | GposBrandShippingVoucherController.create | gpos_brand/shipping_voucher/create | layouts | c:form_text, c:form_date | - | ctrl.json |
| S096 | GET | `/gpos-brand/detail-pesanan/:id` | GposBrandController.detailPesanan | gpos_brand/create | layouts | c:form_text, c:form_number, c:form_textarea | - | ctrl.json |
| S097 | GET | `/gpos-brand` | GposBrandController.index | gpos_brand/list | layouts | - | Superadmin | ctrl.json |
| S098 | GET | `/loyalty-member/:id` | LoyaltyMemberController.programByPrincipalList | loyalty-member/program-principal-list | layouts | c:form_texteditor_quill, c:form_select | - | ctrl.json |
| S099 | GET | `/loyalty-member/:id/voucher` | LoyaltyMemberController.createProgramDetailByPrincipal | loyalty-member/detail-program/create | layouts | loyalty-member/detail-program/form-voucher, c:form_text, c:form_textarea, c:form_number, c:form_image, c:form_date, loyalty-member/detail-program/form, c:form_toggle_switch, includes/script_image_uploader, c:form_select2_custom, c:form_select2 | - | ctrl.json |
| S100 | GET | `/loyalty-member/:id/point` | LoyaltyMemberController.createProgramDetailByPrincipal | loyalty-member/detail-program/create | layouts | loyalty-member/detail-program/form-voucher, c:form_text, c:form_textarea, c:form_number, c:form_image, c:form_date, loyalty-member/detail-program/form, c:form_toggle_switch, includes/script_image_uploader, c:form_select2_custom, c:form_select2 | - | ctrl.json |
| S101 | GET | `/loyalty-member/:id/:program/:type` | LoyaltyMemberController.programDetailByPrincipal | loyalty-member/detail-program/edit | layouts | loyalty-member/detail-program/form-voucher, c:form_text, c:form_textarea, c:form_number, c:form_image, c:form_date, loyalty-member/detail-program/form, c:form_toggle_switch, c:form_select2_custom, c:form_select2 | - | ctrl.json |
| S102 | GET | `/loyalty-member` | LoyaltyMemberController.index | loyalty-member/list | layouts | includes/script_image_uploader, c:loyalty_card, c:form_text, c:form_select_multiple, c:form_toggle_switch, c:form_image | Superadmin | ctrl.json |
| S103 | GET | `/user-verification` | UserVerificationController.index | user_verification/list | layouts | - | Superadmin | ctrl.json |
| S104 | GET | `/personalization/channels` | PersonalizationChannelController.index | personalization/channels/list | layouts | - | Superadmin | ctrl.json |
| S105 | GET | `/personalization/channels/:id` | PersonalizationChannelController.createPage | personalization/channels/create | layouts | personalization/channels/tabs/setup_relation, c:form_text, c:form_toggle_switch, c:form_select_multiple, personalization/channels/tabs/setup_product, personalization/channels/tabs/setup_personalization_channel, c:mobile_app_preview, c:mobile_app_search_preview, personalization/channels/modal_new_group, personalization/channels/modal_add_product, c:form_select2, personalization/channels/modal_relation_conflict | - | ctrl.json |
| S106 | GET | `/` | AuthController.getLogin | login | (standalone) | - | - | AuthController.js:9-16 (also every action's checkAuth fallback) |
| S107 | GET | `/product-gposb2b` | ProductGposb2bController.index | product_gposb2bs/edit | layouts | product_gposb2bs/tabs/product_gposb2b, c:form_text, c:form_image, product_gposb2bs/tabs/product_gposb2b_homepage, c:form_select2_custom, c:form_number, product_gposb2bs/tabs/product_gposb2b_criteria, c:form_select_multiple, includes/script_image_uploader | Superadmin | index delegates to edit() (ProductGposb2bController.js:17-20) |

---

## 5. View Inventory (A1.3)

**Status values:**
- `ACTIVE / REFERENCED`: rendered by a screen.
- `SHARED (partial)`: pulled in with `@include` or `@component`.
- `ORPHAN / UNKNOWN`: neither. These are resolved in §24.

**Related JS.** Every view on the layout gets `main.js` and `cms-toastify.js`. `pagination.js` is loaded only by `setting_point/index`, `gamification/index` and `loyalty-member/program-principal-list`.

The mapper behind each list is given in §7.

| View | Rendered by (screens) | Included by | Layout | Inline script | Inline style | buildtable | Modals | Status |
|---|---|---|---|---|---|---|---|---|
| banners/create | S018 | - | layouts | YES | YES | - | - | ACTIVE / REFERENCED |
| banners/edit | S019 | - | layouts | YES | YES | - | alertdel | ACTIVE / REFERENCED |
| banners/list | S017 | - | layouts | YES | NO | 1 | validationdel, alertdel | ACTIVE / REFERENCED |
| banners/tabs/banner_create | - | banners/create | - | NO | NO | - | - | SHARED (partial) |
| banners/tabs/banner_criteria | - | banners/edit | - | NO | NO | - | - | SHARED (partial) |
| banners/tabs/banner_edit | - | banners/edit | - | NO | NO | - | - | SHARED (partial) |
| components/form_date | - | 16 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_datetimepicker | - | 4 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_image | - | 17 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_number | - | 37 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_radio | - | notifications/tabs/notification_schedule_create, notifications/tabs/notification_schedule_edit | - | NO | NO | - | - | SHARED (partial) |
| components/form_select | - | 25 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_select2 | - | 7 views | - | NO | YES | - | - | SHARED (partial) |
| components/form_select2_custom | - | 11 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_select_multiple | - | 26 views | - | NO | YES | - | - | SHARED (partial) |
| components/form_text | - | 44 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_text_icon | - | group_story/create, group_story/edit | - | NO | NO | - | - | SHARED (partial) |
| components/form_textarea | - | 18 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_texteditor_quill | - | banners/tabs/banner_create, banners/tabs/banner_edit, loyalty-member/program-principal-list | - | NO | NO | - | - | SHARED (partial) |
| components/form_time | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| components/form_timepicker | - | notifications/tabs/notification_schedule_create, notifications/tabs/notification_schedule_edit | - | NO | NO | - | - | SHARED (partial) |
| components/form_toggle_switch | - | 26 views | - | NO | NO | - | - | SHARED (partial) |
| components/form_url | - | banners/tabs/banner_create, banners/tabs/banner_edit | - | NO | NO | - | - | SHARED (partial) |
| components/list_paginate | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| components/loyalty_card | - | loyalty-member/list | - | NO | NO | - | - | SHARED (partial) |
| components/mobile_app_preview | - | personalization/channels/edit copy, personalization/channels/tabs/setup_personalization_channel | - | YES | YES | - | - | SHARED (partial) |
| components/mobile_app_search_preview | - | personalization/channels/tabs/setup_personalization_channel | - | NO | YES | - | - | SHARED (partial) |
| components/paginate | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| contents/create | S040 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| contents/edit | S041 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| contents/list | S039 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| custom_catalog_criterias/create | S037 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| custom_catalog_criterias/edit | S038 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| custom_catalog_criterias/list | S036 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| custom_catalog_product_homepages/create | S030 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| custom_catalog_product_homepages/edit | S031 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| custom_catalog_product_homepages/list | S029 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| custom_catalogs/create | S027 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| custom_catalogs/edit | S028 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| custom_catalogs/list | S026 | - | layouts | YES | NO | 1 | validationdel, alertdel | ACTIVE / REFERENCED |
| custom_catalogs/tabs/custom_catalog_create | - | custom_catalogs/create, user_management/create | - | NO | NO | - | - | SHARED (partial) |
| custom_catalogs/tabs/custom_catalog_edit | - | custom_catalogs/edit, user_management/edit | - | NO | NO | - | - | SHARED (partial) |
| custom_catalogs/tabs/custom_catalog_product_homepage | - | custom_catalogs/edit, user_management/edit | - | NO | NO | - | - | SHARED (partial) |
| custom_catalogs/tabs/custom_catalog_product_homepage_edit | - | - | - | NO | NO | - | {{customCatalog.id}} | ORPHAN / UNKNOWN |
| custom_catalogs/tabs/custom_criteria | - | custom_catalogs/edit, user_management/edit | - | NO | NO | - | - | SHARED (partial) |
| custom_catalogs/tabs/custom_criteria_edit | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| customer_group/create | S073,S074 | - | layouts | YES | YES | - | - | ACTIVE / REFERENCED |
| customer_group/list | S072 | - | layouts | YES | YES | 1 | new_alertdel, cg-alertalldel | ACTIVE / REFERENCED |
| dashboard | S001 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| faqs/create | S043 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| faqs/edit | S044 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| faqs/list | S042 | - | layouts | YES | NO | 1 | new_alertdel | ACTIVE / REFERENCED |
| feedbacks/edit | S006 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| feedbacks/list | S005 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| gamification/components/confirm-cancel-active-mission-modal | - | gamification/index | - | NO | NO | - | confirm-cancel-active-mission-modal | SHARED (partial) |
| gamification/components/confirm-cancel-mission-modal | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | confirm-cancel-mission-modal | SHARED (partial) |
| gamification/components/confirm-erase-mission-modal | - | gamification/edit, gamification/index, gamification/tmp | - | NO | NO | - | confirm-erase-mission-modal | SHARED (partial) |
| gamification/components/confirm-reward-at-start-modal | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | confirm-reward-at-start-modal | SHARED (partial) |
| gamification/components/confirm-save-and-activate-mission-modal | - | gamification/edit, gamification/tmp | - | NO | NO | - | confirm-save-and-activate-mission-modal | SHARED (partial) |
| gamification/components/physical-reward-modal | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | physical-reward-modal, physical-reward-form, exampleModalLabel | SHARED (partial) |
| gamification/components/required-fields-modal | - | gamification/edit | - | NO | NO | - | required-fields-modal | SHARED (partial) |
| gamification/components/voucher-reward-modal | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | voucher-reward-modal, voucher-reward-form, exampleModalLabel | SHARED (partial) |
| gamification/create | S090,S091 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| gamification/create_type | S089 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| gamification/edit | S092,S093 | - | layouts | YES | YES | - | - | ACTIVE / REFERENCED |
| gamification/index | S088 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| gamification/tabs/multi_timeline_create | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | add-new-period | SHARED (partial) |
| gamification/tabs/reward_create | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | - | SHARED (partial) |
| gamification/tabs/setting_create | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | - | SHARED (partial) |
| gamification/tabs/single_timeline_create | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | - | SHARED (partial) |
| gamification/tabs/target_create | - | gamification/create, gamification/edit, gamification/tmp | - | NO | NO | - | csv-data-modal, csv-progress-modal | SHARED (partial) |
| gamification/tmp | - | - | layouts | YES | NO | - | - | ORPHAN / UNKNOWN |
| global_configurations/create | S015 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| global_configurations/edit | S016 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| global_configurations/list | S014 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| gpos_brand/create | S096 | - | layouts | YES | NO | - | penggantianKurirModal, konfirmasiPembatalanModal | ACTIVE / REFERENCED |
| gpos_brand/list | S097 | - | layouts | YES | NO | 1 | - | ACTIVE / REFERENCED |
| gpos_brand/shipping_voucher/create | S095 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| gpos_brand/shipping_voucher/list | S094 | - | layouts | YES | NO | 1 | - | ACTIVE / REFERENCED |
| group_story/create | S021 | - | layouts | YES | YES | - | gs-discard-modal | ACTIVE / REFERENCED |
| group_story/edit | S022 | - | layouts | YES | YES | - | - | ACTIVE / REFERENCED |
| group_story/list | S020 | - | layouts | YES | YES | 1 | gs-alertdel, gs-alertalldel | ACTIVE / REFERENCED |
| includes/script_image_uploader | - | 19 views | - | YES | NO | - | - | SHARED (partial) |
| inventories/create | S076 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| inventories/edit | S077 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| inventories/inventory-stock-modal | - | inventories/edit | - | NO | NO | - | istock-modal, istock-form, exampleModalLabel | SHARED (partial) |
| inventories/list | S075 | - | layouts | YES | NO | 1 | new_alertdel | ACTIVE / REFERENCED |
| layouts | - | - | - | YES | NO | - | alertalldel | SHARED (layout) |
| login | S106 | - | - | NO | NO | - | - | ACTIVE / REFERENCED |
| loyalty-member/detail-program/create | S099,S100 | - | layouts | YES | NO | - | addProductModal, customAlert | ACTIVE / REFERENCED |
| loyalty-member/detail-program/edit | S101 | - | layouts | YES | NO | - | addProductModal, customAlert | ACTIVE / REFERENCED |
| loyalty-member/detail-program/form | - | loyalty-member/detail-program/create, loyalty-member/detail-program/edit | - | NO | NO | - | - | SHARED (partial) |
| loyalty-member/detail-program/form-voucher | - | loyalty-member/detail-program/create, loyalty-member/detail-program/edit | - | NO | NO | - | - | SHARED (partial) |
| loyalty-member/list | S102 | - | layouts | YES | NO | - | addPrincipalModal | ACTIVE / REFERENCED |
| loyalty-member/program-principal-list | S098 | - | layouts | YES | NO | - | getPointModal, programTypeModal | ACTIVE / REFERENCED |
| notifications/create | S010 | - | layouts | YES | NO | - | alertdel, alertpreview, notification-publish-modal, notification-changeupdate-modal | ACTIVE / REFERENCED |
| notifications/edit | S011 | - | layouts | YES | NO | - | alertdel, notification-cancel-modal, notification-final-modal, notification-delete-modal, notification-publish-modal, notification-changeupdate-modal | ACTIVE / REFERENCED |
| notifications/list | S009 | - | layouts | YES | NO | 1 | alertdel, notification-cancel-modal, notification-final-modal | ACTIVE / REFERENCED |
| notifications/tabs/notification_preview | - | notifications/create, notifications/edit | - | NO | NO | - | notification-preview-modal | SHARED (partial) |
| notifications/tabs/notification_relation_create | - | notifications/create | - | NO | NO | - | - | SHARED (partial) |
| notifications/tabs/notification_relation_edit | - | notifications/edit | - | NO | NO | - | - | SHARED (partial) |
| notifications/tabs/notification_schedule_create | - | notifications/create | - | NO | NO | - | - | SHARED (partial) |
| notifications/tabs/notification_schedule_edit | - | notifications/edit | - | NO | NO | - | - | SHARED (partial) |
| notifications/tabs/notification_setting_create | - | notifications/create | - | NO | NO | - | - | SHARED (partial) |
| notifications/tabs/notification_setting_edit | - | notifications/edit | - | NO | NO | - | - | SHARED (partial) |
| order_reviews/edit | S013 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| order_reviews/list | S012 | - | layouts | YES | NO | 1 | - | ACTIVE / REFERENCED |
| orders/edit | S008 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| orders/list | S007 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| payment/detail | S086 | - | layouts | YES | YES | - | manualtrigger | ACTIVE / REFERENCED |
| payment/list | S085 | - | layouts | YES | YES | 1 | - | ACTIVE / REFERENCED |
| payment/tabs/search | - | payment/list | - | NO | NO | - | - | SHARED (partial) |
| personalization/channels/create | S105 | - | layouts | YES | YES | 1 | modal-confirm-publish, modal-confirm-delete-product | ACTIVE / REFERENCED |
| personalization/channels/edit | - | - | layouts | YES | YES | - | - | ORPHAN / UNKNOWN |
| personalization/channels/edit copy | - | - | layouts | YES | YES | - | - | ORPHAN / UNKNOWN |
| personalization/channels/list | S104 | - | layouts | YES | YES | 1 | modal-add-channel, modal-delete | ACTIVE / REFERENCED |
| personalization/channels/modal_add_product | - | personalization/channels/create, personalization/channels/edit copy, personalization/channels/edit | - | NO | NO | - | modal-add-product | SHARED (partial) |
| personalization/channels/modal_new_group | - | personalization/channels/create, personalization/channels/edit copy, personalization/channels/edit | - | NO | NO | - | modal-new-group | SHARED (partial) |
| personalization/channels/modal_relation_conflict | - | personalization/channels/create, personalization/channels/edit | - | NO | NO | - | modal-relation-conflict | SHARED (partial) |
| personalization/channels/tabs/setup_personalization_channel | - | personalization/channels/create, personalization/channels/edit | - | NO | NO | - | - | SHARED (partial) |
| personalization/channels/tabs/setup_product | - | personalization/channels/create, personalization/channels/edit | - | NO | NO | - | - | SHARED (partial) |
| personalization/channels/tabs/setup_relation | - | personalization/channels/create, personalization/channels/edit | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/inject_point/create | S062 | - | layouts | NO | NO | - | exit-inject-point | ACTIVE / REFERENCED |
| poin_voucher/inject_point/create_summary | S061 | - | layouts | NO | NO | - | save-inject-point | ACTIVE / REFERENCED |
| poin_voucher/inject_point/list | S063 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| poin_voucher/list | S065 | - | layouts | NO | NO | - | modaldev | ACTIVE / REFERENCED |
| poin_voucher/mutasi_redeem/filter | S064 | - | layouts | YES | NO | 1 | - | ACTIVE / REFERENCED |
| poin_voucher/mutasi_redeem/tabs/search | - | poin_voucher/mutasi_redeem/filter | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/setting_point/create_bonus_point_program | S053 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/setting_point/create_bonus_point_program_summary | S054 | - | layouts | YES | NO | - | modal-draft, alertnext | ACTIVE / REFERENCED |
| poin_voucher/setting_point/create_point | S059 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/setting_point/create_point_folamil | S058 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/setting_point/create_point_folamil_summary | S057 | - | layouts | YES | NO | - | alertnext | ACTIVE / REFERENCED |
| poin_voucher/setting_point/create_point_payment | S052 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/setting_point/create_point_payment_summary | S051 | - | layouts | YES | NO | - | alertnext | ACTIVE / REFERENCED |
| poin_voucher/setting_point/create_point_reguler | S050 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/setting_point/edit_bonus_point_program | S055 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/setting_point/edit_bonus_point_program_summary | S056 | - | layouts | YES | NO | - | modal-draft, alertnext | ACTIVE / REFERENCED |
| poin_voucher/setting_point/index | S060 | - | layouts | YES | NO | - | alertupdatestatusactive, alertupdatestatusinactive | ACTIVE / REFERENCED |
| poin_voucher/setting_point/program/combination_and | - | poin_voucher/setting_point/create_bonus_point_program, poin_voucher/setting_point/edit_bonus_point_program | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/setting_point/program/combination_or | - | poin_voucher/setting_point/create_bonus_point_program, poin_voucher/setting_point/edit_bonus_point_program | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/setting_point/program/folamil | - | poin_voucher/setting_point/edit_bonus_point_program | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/setting_point/program/multi_level_program | - | poin_voucher/setting_point/create_bonus_point_program, poin_voucher/setting_point/edit_bonus_point_program | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/setting_point/program/pembayaran | - | poin_voucher/setting_point/edit_bonus_point_program | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/setting_point/program/regular | - | poin_voucher/setting_point/edit_bonus_point_program | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/setting_point/program/single_item | - | poin_voucher/setting_point/create_bonus_point_program, poin_voucher/setting_point/edit_bonus_point_program | - | NO | NO | - | - | SHARED (partial) |
| poin_voucher/voucher_setting/list | S071 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/voucher_setting/voucher_category/create | S067 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/voucher_setting/voucher_category/create_summary | S068 | - | layouts | YES | NO | - | alertnext | ACTIVE / REFERENCED |
| poin_voucher/voucher_setting/voucher_category/edit | S069 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/voucher_setting/voucher_category/edit_summary | S070 | - | layouts | YES | NO | - | alertnext | ACTIVE / REFERENCED |
| poin_voucher/voucher_setting/voucher_category_view | S066 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| poin_voucher/voucher_setting/voucher_digital/list | - | - | layouts | NO | NO | - | - | ORPHAN / UNKNOWN |
| poin_voucher/voucher_setting/voucher_e-wallet/list | - | - | layouts | NO | NO | - | - | ORPHAN / UNKNOWN |
| poin_voucher/voucher_setting/voucher_folamil/list | - | - | layouts | NO | NO | - | - | ORPHAN / UNKNOWN |
| poin_voucher/voucher_setting/voucher_listrik/list | - | - | layouts | NO | NO | - | - | ORPHAN / UNKNOWN |
| poin_voucher/voucher_setting/voucher_pulsa/create | - | - | layouts | NO | NO | - | - | ORPHAN / UNKNOWN |
| poin_voucher/voucher_setting/voucher_pulsa/create_summary | - | - | layouts | YES | NO | - | alertnext | ORPHAN / UNKNOWN |
| poin_voucher/voucher_setting/voucher_pulsa/list | - | - | layouts | NO | NO | - | - | ORPHAN / UNKNOWN |
| principals/create | S003 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| principals/edit | S004 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| principals/list | S002 | - | layouts | YES | NO | 1 | alertdel | ACTIVE / REFERENCED |
| product_category/create | S048 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| product_category/edit | S049 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| product_category/list | S047 | - | layouts | YES | NO | 1 | new_alertdel | ACTIVE / REFERENCED |
| product_gposb2bs/edit | S032,S107 | - | layouts | YES | YES | 1 | alertdel | ACTIVE / REFERENCED |
| product_gposb2bs/tabs/product_gposb2b | - | product_gposb2bs/edit | - | NO | NO | - | - | SHARED (partial) |
| product_gposb2bs/tabs/product_gposb2b_criteria | - | product_gposb2bs/edit | - | NO | NO | - | - | SHARED (partial) |
| product_gposb2bs/tabs/product_gposb2b_homepage | - | product_gposb2bs/edit | - | NO | NO | - | - | SHARED (partial) |
| product_restrictions/create | S082 | - | layouts | NO | NO | - | - | ACTIVE / REFERENCED |
| product_restrictions/edit | S083 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| product_restrictions/list | S081 | - | layouts | YES | NO | 1 | new_alertdel | ACTIVE / REFERENCED |
| products/edit | S046 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| products/list | S045 | - | layouts | YES | NO | 1 | new_alertdel | ACTIVE / REFERENCED |
| referral_code/create | S024 | - | layouts | YES | YES | - | - | ACTIVE / REFERENCED |
| referral_code/edit | S025 | - | layouts | YES | YES | - | - | ACTIVE / REFERENCED |
| referral_code/list | S023 | - | layouts | YES | YES | 1 | tsc-modal-delete, tsc-modal-bulk-delete | ACTIVE / REFERENCED |
| referral_code/tab/setting-telesales-code | - | referral_code/create, referral_code/edit | - | NO | NO | - | - | SHARED (partial) |
| referral_code/tab/setting-transaction-channel | - | referral_code/create, referral_code/edit | - | NO | NO | - | - | SHARED (partial) |
| register_folamil/index | S087 | - | layouts | YES | NO | - | modal-leave | ACTIVE / REFERENCED |
| sponsored_products/create | S079 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| sponsored_products/edit | S080 | - | layouts | YES | NO | - | - | ACTIVE / REFERENCED |
| sponsored_products/list | S078 | - | layouts | YES | NO | 1 | new_alertdel | ACTIVE / REFERENCED |
| user_management/create | - | - | layouts | NO | NO | - | - | ORPHAN / UNKNOWN |
| user_management/edit | - | - | layouts | YES | NO | 1 | alertdel | ORPHAN / UNKNOWN |
| user_management/list | S084 | - | layouts | YES | NO | 1 | validationdel, alertdel | ACTIVE / REFERENCED |
| user_management/tabs/custom_catalog_create | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| user_management/tabs/custom_catalog_edit | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| user_management/tabs/custom_catalog_product_homepage | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| user_management/tabs/custom_criteria | - | - | - | NO | NO | - | - | ORPHAN / UNKNOWN |
| user_verification/list | S103 | - | layouts | YES | NO | 1 | reviewModal, reviewModalLabel, editModal, editModalLabel, rejectConfirmModal | ACTIVE / REFERENCED |

---

## 6. Screen / Capability Inventory (A1.4)

| Capability | Screens | Trigger / UI | Frontend code | Backend route | Controller / Mapper | Validation |
|---|---|---|---|---|---|---|
| Create | S003, S015, S018, S021, S024, S027, S030, S037, S040, S043, S048, S073, S076, S079, S082, S090, S095, S099/S100, S102 (modal) | "Create New…" / "Tambah" / "Buat" | Native POST, or AJAX (Banner, Group Story, Customer Group, Gamification, Loyalty card) | `POST /<res>`, `…/create`, `…/save` | `*.store` | §17 |
| Edit | S004, S006, S008 (read-only), S011, S016, S019, S022, S025, S028, S031, S038, S041, S044, S046, S049, S055, S069, S074, S077, S080, S083, S092, S096, S101, S105, S107 | Edit link built by the Mapper; eye icon | `?_method=PUT` form, or AJAX | `PUT /<res>/:id` | `*.update` | §17 |
| Delete one row | Most lists | Mapper-built `.alertdel` / `.new_alertdel`, or custom buttons | `main.js` modals; custom modals (Group Story, Referral, Channel) | `POST */delete`, `DELETE /<res>/:id` | `*.delete` / `*.destroy` | None |
| Bulk delete | S002, S005, S007 (broken), S014, S017, S020, S023, S026, S029, S036, S039, S042, S045 (dead), S047, S063 (labelled "Cancel"), S072, S075, S078, S081 (no trigger), S105 products tab, S107 tab 2 | Row checkboxes + footer button → `#alertalldel` or a custom modal | `main.js:87-117,192-201` | `POST */multidelete`, `DELETE /<res>` | `*.multidelete` / `deleteBulk` | Empty selection → silent redirect or flash |
| Global search | All DataTables lists unless `searching:false` | DataTables search box | `buildtable` | `*/datatable` | `To*ListRequest` → `keyword` | — |
| Structured search (type + keyword) | S007, S084, S103 | A select plus a keyword, serialised as JSON into `search.value` | Inline JS | `*/datatable` | Mapper parses the JSON | — |
| Filter | S017, S045, S009, S104, S103, S085, S064, S084, S088 | Selects, chips, `ajaxData` | Inline JS | `*/datatable`, `/gamification/list` | §19 | — |
| Sort | DataTables lists | Header click; `no-sort` disables it | Default is the last column | `sort_by` / `asc_desc` | Mapper | — |
| Pagination | All lists | DataTables pager or `pagination.js` | `main.js`, `pagination.js` | `page` / `take`, or `page` / `showPerPage` | Mapper | — |
| Export (browser) | See §20 | Buttons: copy / excel / pdf / print / colvis | `buildtable` | None | — | — |
| Download (server or template) | S087, S092/S093, S099/S100, S102 | "Download CSV" | fetch / axios / link | `/gamification/:id/generate-csv*`, `/loyalty-member/generate-csv`, external OSS | Gamification, LoyaltyMember | — |
| CSV import | S087, S092/S093, S099/S100, S102 | File → OSS → Upload | `script_image_uploader` + inline JS | `/register-folamil`, `/gamification/upload-csv*`, `/loyalty-member/validate-branch-csv` | RegisterFolamil, Gamification, LoyaltyMember | Client check + server CSV parse |
| Image upload | 19 views (§16) | `form_image` / `.image_uploader` | `script_image_uploader.edge` | `POST /files/signurl` + PUT to the signed URL | FileController | `FileSignURL` |
| Local file upload | S003 | `uplimages[]` | FileReader preview | `POST /principal` (multipart) | Saved to `public/images` | Image, 2 MB |
| Toggle / activate | S017, S020, S026, S060, S066, S084, S092, S105 | bootstrapToggle, kebab "Aktif/Non Aktif" | Inline AJAX or form | `PUT /banner/:id`, `/group-story/:id`, `/custom-catalog/:id`, `/poin-voucher/setting-point/update-status`, `/voucher-setting/:code/update-is-active/:id`, `/user-management/:id/update-is-active`, `/gamification/:id/update-status` | Various | None on the client |
| Inline sequence edit | S017, S020, S026 | Number input in a cell; Enter or blur | Inline AJAX | `PUT /<res>/:id` | update | None |
| Approve / reject | S103 | TINJAU → `#reviewModal` | Inline AJAX | `POST /user-verification/:id/{approve,reject,update}` | UserVerification | Client date checks |
| Cancel / finalise | S009/S011, S063, S094, S096 | Dropdown or button → confirmation | `main.js` + inline JS | `/notification/{cancel,final}`, `DELETE /poin-voucher/inject-point`, `/gpos-brand/shipping-voucher/:id/cancel`, `/gpos-brand/:id/update-status-to-canceled` | Various | — |
| Sync status | S007 | `.btn-sync` | axios | `PUT /order/:id/sync-status` | OrderController.syncStatus | — |
| Trigger receipt | S086 | Date modal | Form | `POST /payment/:id` | postTriggerReceipt | Client date |
| Duplicate | S088 → S093 | "Duplikat" | Link + JSON save | `POST /gamification` (`id:'duplicate'`) | Gamification.store | GamificationCreateDraft |
| Preview | S010/S011 (phone mock), S105 (mobile app preview), image previews | Preview button, toggles | Inline JS | — | — | Client completeness check |
| View detail | S013, S086, S092, S096, S101, S103 (modal) | Eye icon, link, TINJAU | Mapper-built links | Detail routes | — | — |
| Tabs | S018/S019, S027/S028, S032/S107, S010/S011, S090-S093, S024/S025, S105 | `data-toggle="tab"` | Bootstrap | — | — | — |
| Wizard | S059→S053→S054→store; S055→S056→update; S062→S061→store; S067→S068→store; S069→S070→update; S104→S105 | "Selanjutnya" / "Simpan" | Forms with hidden carry-over fields | Summary + store routes | PoinVoucher*, PersonalizationChannel | Per step |
| Select / multi-select / autocomplete | ~60 views | select2 `data-url` (`form_select2`, `form_select2_custom`, `form_select_multiple`); Choices (S003 only) | `main.js:346-463` | OPTIONS routes (§23) | — | — |
| Date / time | Forms using `form_date`, `form_datetimepicker` (gijgo), `form_timepicker`, bootstrap-datepicker (S024/S025, S086) | Linked min/max | Inline JS | — | — | Server date checks (§17) |
| Rich text | S018/S019 (Quill `content`), S098 (`#getPointModal`) | `form_texteditor_quill` | Quill from CDN | — | — | — |
| Copy to clipboard | 2 views (`clipboard.writeText`) | Button | Inline JS | — | — | — |
| Generate template | S099/S100, S102 | "Unduh Template CSV" | axios | `POST /loyalty-member/generate-csv` (returns a template URL) | LoyaltyMember | — |
| Drag reorder | S021/S022 (selected banners) | HTML5 drag | Inline JS | Order saved as `banner_ids` | GroupStory | — |

---

## 7. DataTable Inventory (A1.5)

### Shared behavior of `buildtable` [SOURCE `public/assets/js/main.js:8-160`]

- **Options:** `serverSide`, `processing`, `responsive`, `colReorder`, `rowReorder`.
- **Paging:** `pageLength` 5; `lengthMenu` 5/10/25/50/All.
- **Default order:** the last column, in the direction passed as `sort`.
- **Request:** POST with `_csrf`. When `ajaxData` is supplied, `_csrf` is dropped, but the `X-CSRF-TOKEN` header is still sent.
- **Buttons:** copy / excel / pdfHtml5 (LEGAL) / print / colvis, unless `customOptions.showButtons` restricts them.
- **`drawCallback` wiring:**
  - Select-all checkbox and row checkboxes, which enable the hidden `item[]` inputs.
  - `.alertdel` → `#alertdel`.
  - `.new_alertdel` → rewrites the `#new_alertdel` form action.
  - The notification cancel and final modals.
  - These handlers are re-bound on every draw, so they probably stack up [INFERRED].

**Standard request mapping:**

| Request field | Built from |
|---|---|
| `sort_by` | `columns[order.column].name` |
| `asc_desc` | Sort direction |
| `page` | `start/length + 1` |
| `take` | `length` |
| `keyword` | `search.value` |

Screen-specific filters are added on top of these (§19).

**Response.** DataTables JSON with HTML strings as cells [INFERRED; the exact keys are for A2].

| Screen view | Selector | Datatable route | Sort | Export filename | Columns var | Controller datatable action exists | HTML cells source |
|---|---|---|---|---|---|---|---|
| banners/list | `$('#dataTable-custom-catalogs')` | BannerController.datatable | ASC | Banners | columns | YES | BannerMapper.ToBannerListSuccessResponse |
| contents/list | `$('#dataTable-contents')` | ContentController.datatable | DESC | Contents | columns | YES | ContentController.datatable (controller) |
| custom_catalog_criterias/list | `$('#dataTable-custom-criterias')` | CustomCriteriaController.datatable | DESC | CustomCriterias | columns | YES | CustomCriteriaMapper.ToCustomCriteriaListSuccessResponse |
| custom_catalog_product_homepages/list | `$('#dataTable-custom-catalog-product-homepages')` | CustomCatalogProductHomepageController.datatable | DESC | CustomCatalogProductHomepages | columns | YES | CustomCatalogProductHomepageMapper.ToCustomCatalogProductHomepageListSuccessResponse |
| custom_catalogs/edit | `$('#dataTable-custom-catalog-product-homepages')` | "/custom-catalog-product-homepage/datatable_customcatalog/{{customCatalog.id}}" | DESC | CustomCatalogProductHomepages | columns | NO | none found |
| custom_catalogs/list | `$('#dataTable-custom-catalogs')` | CustomCatalogController.datatable | DESC | CustomCatalogs | columns | YES | CustomCatalogMapper.ToCustomCatalogListSuccessResponse |
| customer_group/list | `$('#dataTable')` | CustomerGroupController.datatable | DESC | CustomerGroups | columns | YES | CustomerGroupController.datatable (controller) |
| faqs/list | `$('#dataTable')` | FAQController.datatable | DESC | FAQs | columns | YES | FAQController.datatable (controller) |
| feedbacks/list | `$('#dataTable-feedbacks')` | FeedbackController.datatable | DESC | Feedbacks | columns | YES | FeedbackController.datatable (controller) |
| global_configurations/list | `$('#dataTable-global-configurations')` | GlobalConfigurationController.datatable | DESC | GlobalConfigurations | columns | YES | GlobalConfigurationMapper.ToGlobalConfigurationListSuccessResponse |
| gpos_brand/list | `$('#dataTable')` | GposBrandController.datatable | ASC | principal | columns | YES | GposBrandMapper.toListSuccessResponse |
| gpos_brand/shipping_voucher/list | `$('#dataTable')` | GposBrandShippingVoucherController.datatable | ASC | principal | columns | YES | none found |
| group_story/list | `$('#dataTable-group-story')` | GroupStoryController.datatable | DESC | GroupStory | columns | YES | GroupStoryController.datatable (controller) |
| inventories/list | `$('#dataTable')` | InventoryController.datatable | DESC | Inventorys | columns | YES | InventoryController.datatable (controller) |
| notifications/list | `$('#dataTable-notification')` | NotificationController.datatable | DESC | Notifications | columns | YES | NotificationMapper.ToNotificationListSuccessResponse |
| order_reviews/list | `$('#dataTable-order-review')` | OrderReviewController.datatable | DESC | OrderReviews | columns | YES | OrderReviewMapper.ToOrderReviewListSuccessResponse |
| orders/list | `$('#dataTable-feedbacks')` | OrderController.datatable | DESC | Orders | columns | YES | OrderMapper.ToOrderListSuccessResponse |
| payment/list | `$('#dataTable-payment')` | PaymentController.datatable | DESC | Payment | columns | YES | PaymentMapper.ToListSuccessResponse |
| personalization/channels/create | `$('#dataTable')` | PersonalizationChannelController.datatableProduct | DESC | ProductChannels | createProdColumns | YES | PersonalizationChannelMapper.mapToDatatableResponse |
| personalization/channels/list | `$('#dataTable')` | PersonalizationChannelController.datatable | D | esc | columns | YES | PersonalizationChannelController.datatable (controller) |
| poin_voucher/inject_point/list | `$('#dataTable-inject-point')` | PoinVoucherController.injectPoinDatatable | DESC | InjectPoint | columns | YES | InjectPoinMapper.ToListSuccessResponse |
| poin_voucher/mutasi_redeem/filter | `$('#dataTable-redeem-point')` | MutasiRedeemPoinController.datatable | DESC | RedeemPoint | columns | YES | MutasiRedeemPoinMapper.toMutasiRedeemPoinRegulerListSuccessResponse |
| principals/list | `$('#dataTable-principals')` | PrincipalController.datatable | DESC | Principals | columns | YES | PrincipalController.datatable (controller) |
| product_category/list | `$('#dataTable')` | ProductCategoryController.datatable | DESC | ProductCategorys | columns | YES | ProductCategoryController.datatable (controller) |
| product_gposb2bs/edit | `$('#dataTable-product-gposb2b-homepage')` | ProductGposb2bHomepageController.datatable | DESC | ProductGposb2bHomepages | columns | YES | ProductGposb2bHomepageMapper.ToProductGposb2bHomepageListSuccessResponse |
| product_restrictions/list | `$('#dataTable')` | ProductRestrictedController.datatable | DESC | ProductRestrictions | columns | YES | ProductRestrictedController.datatable (controller) |
| products/list | `$('#dataTable')` | ProductController.datatable | ASC | Products | columns | YES | ProductController.datatable (controller) |
| referral_code/list | `$('#dataTable-referral-code')` | ReferralCodeController.datatable | - | asc | columns | YES | ReferralCodeMapper.ToReferralCodeListSuccessResponse |
| sponsored_products/list | `$('#dataTable')` | SponsoredProductController.datatable | DESC | SponsoredProducts | columns | YES | SponsoredProductController.datatable (controller) |
| user_management/edit | `$('#dataTable-custom-catalog-product-homepages')` | "/custom-catalog-product-homepage/datatable_customcatalog/{{customCatalog.id}}" | DESC | CustomCatalogProductHomepages | columns | NO | none found |
| user_management/list | `$('#dataTable-custom-catalogs')` | UserManagementController.datatable | DESC | UserManagements | columns | YES | UserManagementMapper.ToUserManagementListSuccessResponse |
| user_verification/list | `$('#dataTable')` | UserVerificationController.datatable | DESC | Daftar Verifikasi Akun | columns | YES | none found |

### List screens that do not use DataTables [SOURCE]

| Screen | Mechanism | Endpoint | Pagination |
|---|---|---|---|
| S060 Setting Point | axios JSON + client-built cards | `GET /poin-voucher/list` (`page, showPerPage, keyword, search_by=name`) | `pagination.js` |
| S088 Gamification | axios JSON + cards | `GET /gamification/list` (`page, showPerPage, keyword, search_by, is_multi_period`) | `pagination.js` |
| S098 Loyalty principal programs | `$.fn.customDataTable` template + axios | `GET /loyalty-member/:id/list` (`page, limit`; `search` is ignored) | `pagination.js` |
| S102 Loyalty Member cards | Server-rendered `loyalty_card` components | None (controller loads 100) | None |
| S065 Poin & Voucher hub | Static cards | — | — |
| S071 Voucher categories | Server-rendered cards | — | None |
| S066 Vouchers per type | Server-rendered grouped cards | — | None |
| S087 Register Folamil | Upload page, not a list | — | — |
| S033 ProductGposb2bHomepage list | **View missing** | Datatable route exists | — |

S028 calls `POST /custom-catalog-product-homepage/datatable_customcatalog/:id` with a literal URL rather than through `route()`.

---

## 8. Mapper-generated UI (A1.6)

This section describes what the server-built HTML does; the markup itself is not reproduced. None of these functions has a role or email condition. URL forms are kept exactly as found: relative (`./x`) or absolute (`/x`).

| Function | Endpoint → Screen | Columns | What it represents | URL | Conditional visibility |
|---|---|---|---|---|---|
| `BannerMapper.ToBannerListSuccessResponse` | `/banner/datatable` → S017 | check, action, sequence, image, active, display mode | Edit, Delete (`.alertdel`), inline sequence input carrying every field in `data-*`, Active/Inactive toggle with spinner, image or story_image | `./banner/:id/edit` | Image depends on `display_mode` including STORY; display label depends on type |
| `CustomCatalogMapper.ToCustomCatalogListSuccessResponse` | S026 | action, sequence, is_active | Edit, Delete, inline `.sequenceEdit`, toggle | `./custom-catalog/:id/edit` | — |
| `CustomCatalogProductHomepageMapper.To…ListSuccessResponse` | S029, S028 tab | action | Delete only | — | — |
| `CustomCriteriaMapper.ToCustomCriteriaListSuccessResponse` | S036 | action | Edit (**links to `./custom-catalog-product-homepage/:id/edit`**), Delete | Wrong target [SOURCE :24] | — |
| `GlobalConfigurationMapper.To…ListSuccessResponse` | S014 | action | Edit, Delete | `./global-configuration/:id/edit` | — |
| `GposBrandMapper.toListSuccessResponse` | S097 | AKSI, STATUS | Detail link with an edit or eye icon; status label | `/gpos-brand/detail-pesanan/:sales_order_id` | Edit icon when PENDING_ORDER, READY_TO_PICKUP or IN_DELIVERY |
| `GposBrandShippingVoucherMapper` | S094 | AKSI, STATUS | Close (cancel) button; Aktif/Selesai | — | Cancel only when ACTIVE |
| `InjectPoinMapper.ToListSuccessResponse` | S063 | check, action | Checkbox + red "Cancel" (`.alertdel`) | — | — |
| `MutasiRedeemPoinMapper.toMutasiRedeemPoinRegulerListSuccessResponse` | S064 | Deskripsi | REDEEM: voucher name, date and badge Sukses/Proses/Gagal. Invoice rows: date, number and total (Rupiah) | — | By mutation type and status |
| `NotificationMapper.ToNotificationListSuccessResponse` | S009 | Single card column | Whole card: title, created/updated by, status badge, dropdown (Detail / Edit / Batalkan / Selesaikan / Hapus), sent time, period, frequency | `/notification/:id/edit` | Per status: DRAFT → Edit, Hapus. SCHEDULED → Detail, Batalkan (not yet sent) or Selesaikan (already sent). SENT → Detail. CANCELED → Detail, Hapus |
| `OrderMapper.ToOrderListSuccessResponse` | S007 | check, action, status | Eye (title "Edit"), Sync Status (`.btn-sync`), Delete; status text Diproses / Selesai / Dikirim / Ditolak / Dikonfirmasi | `./order/:id/edit` | — |
| `OrderReviewMapper.To…ListSuccessResponse` | S012 | action | Detail (eye) | `./order-review/:id/edit` | — |
| `PaymentMapper.ToListSuccessResponse` / `toPaymentDetail` | S085 / S086 | payment no, status, receipt | Detail link; badges PAID / UNPAID ("PENDING") / CANCEL / raw value; APPLIED/UNAPPLIED; receipt list | `/payment/:id` | Bank hidden for CC. "Trigger Receipt" only when bank is BCA and status is not PAID |
| `PersonalizationChannelMapper.mapToDatatableResponse` | S105 products tab | check, action, lists | Edit, Delete; category / principal / lini / sublini / product lists | — | — |
| `PersonalizationChannelController.datatable` | S104 | Aksi, Status | Edit; badge Aktif / Tidak Aktif / Draft | `/personalization/channels/:id` | Delete hidden when status is ACTIVE |
| `ProductGposb2bHomepageMapper.To…ListSuccessResponse` | S107 tab 2 | action | Delete only | — | — |
| `UserManagementMapper.ToUserManagementListSuccessResponse` | S084 | first column | Account active toggle; rows grouped per Cust. ID | — | Row Delete is commented out |
| `UserVerificationMapper` | S103 | AKSI, STATUS | TINJAU (PENDING), EDIT (APPROVED), nothing (REJECTED); status pill | — | By status |
| `ReferralCodeMapper.ToReferralCodeListSuccessResponse` / `ToReferralCodeStatusBadge` | S023 | check, Aksi, Status | Edit, Delete (`.btn-tsc-delete`); Aktif / Tidak Aktif / Draft | `/referral-code/:id/edit` | — |
| `GamificationMapper.getStatusBadge*` / `ToListResponse` | S088 (JSON) | badges | Draft / Aktif / Selesai; phase labels | — | By status and phase |
| Controller `datatable` actions: Content, CustomerGroup, FAQ, Feedback, GroupStory, Inventory, Principal, ProductCategory, Product, ProductRestricted, SponsoredProduct | Their lists | check, action | Edit + Delete (`.alertdel` / `.new_alertdel`). GroupStory also has a toggle and sequence input. Product has Edit only | `./x/:id/edit` or `/x/:id/edit` | ProductRestricted has no checkbox |
| `RegisterFolamilController.store` | S087 (flash) | Flash HTML | "Upload Selesai" list, rendered raw with `{{{ }}}` | — | Success or failure |

---

## 9. Inline JavaScript (A1.7)

The CSRF token is sent either as the layout's `X-CSRF-TOKEN` header or as a `_csrf` field.

| Screen | Trigger / handler | Endpoint | Expected response | UI effect |
|---|---|---|---|---|
| S007 | `#btn-search` | DataTables `search.value` = JSON `{custId, filter, keyword}` | Datatable JSON | Redraw |
| S007 | `.btn-sync` | axios `PUT /order/:id/sync-status` | `{code, data.message}` | Green or red alert, fades after 5 s; button disabled |
| S085 | `#buttonSearch` | `ajaxData {aam_customer_ids, start_date, end_date}` | Datatable JSON | Redraw; date min/max linked |
| S086 | `.manualtrigger` | Opens `#manualtrigger`; datepicker writes hidden `date` | — | Form POST `/payment/:id` |
| S077 | `#istock-new`, `.istock-edit` | Sets the `#istock-modal` form action (store or `?_method=PUT`) | Redirect back | Form modal |
| S077 | `.istock-del` | `confirm()`, then `$.ajax POST …/inventory-stocks/:sid?_method=DELETE` | `{}` | `location.reload()` |
| S017 | Toggle change; sequence Enter/blur | `POST /banner/:id?_method=PUT` with the full record | JSON | Reload, or revert + `showToastifyError` |
| S017 | `#filter-status`, `#filter-type` | Column search | — | Redraw |
| S018/S019 | Changes to type, `display_mode`, `content_type`, `#cust-id-method`; `updateSaveButtonState` | — | — | Show/hide/enable fields; Save enabled only when complete |
| S018/S019 | Save | `POST /banner` or `POST /banner/:id?_method=PUT` (serialised form) | JSON | Toast; redirect |
| S020 | Toggle / sequence | `POST /group-story/:id?_method=PUT` | JSON | Reload, or revert + toast |
| S020 | `.gs-row-delete` | `#gs-alertdel` → `DELETE /group-story/:id` | Redirect | — |
| S021/S022 | `#Cari` (300 ms debounce) | `GET /group-story/available-banners?keyword=` | List | Available banners; Tambah; drag reorder; remove |
| S021/S022 | `#btn-save-gs` | `POST /group-story` or `PUT /group-story/:id?source=edit-form` (JSON) | JSON | Toast; redirect |
| S009 | Status chips | Column 0 search | — | Redraw |
| S010/S011 | Every submit is intercepted | axios `POST /notification/save` or `POST /notification/:id?_method=PUT` | `code` 200 / 300 / other | 200 → list; 300 → `#error-<field>`; other → `#alert_notif` for 5 s |
| S010/S011 | Preview | — | — | `#notification-preview-modal`, or alert "Lengkapi data…" |
| S010/S011 | `beforeunload` after any input | — | — | `#notification-changeupdate-modal` |
| S088 | Search, show, filter, pagination; delete | `GET /gamification/list`; `POST /gamification/delete` | JSON | Cards; reload |
| S090-S093 | Save; change detection; tabs; reward modals; CSV upload/download/history | `POST /gamification`, `PUT /gamification/:id`, `POST /gamification/:id/post-update`, `/gamification/:id/generate-csv*`, `POST /gamification/upload-csv*`, `GET /gamification/upload-csv-history/:id` | JSON | toastr; `is-invalid` + tab dots; loading overlay; fields locked per phase |
| S023 | Row or bulk delete | Sets the form action with `?_method=DELETE` | Redirect | Toasts from flash |
| S024/S025 | Required-field watcher; product criteria switch; min-purchase toggle | — | — | Enable/disable Save and fields |
| S073/S074 | `#btn-save-cg` | `POST /customer-groups` or `PUT /customer-groups/:id` (JSON) | `{success}` | Redirect, or `#cg-form-error` + toast |
| S104 | Status chips; delete; add channel | Column search; `axios.delete /personalization/channels/:id`; `POST /personalization/channels/create` | JSON / redirect | `ajax.reload()`; `alert()` on failure; redirect to the new id |
| S104 | `loadData()` | `GET /cms/personalization/channels/list` (**no such route**) | — | Writes "Gagal memuat data." into the tbody [INFERRED] |
| S105 | Mutually exclusive relation fields; "Cek Data Relasi"; cascading product selects; save/publish | `POST /personalization/channels/customers-validate`, `…/:id/products/save`, `DELETE …/products/:id` or `…/products/bulk`, `POST /personalization/channels/:id` | JSON, or `redirect('back')` | Toasts; `#modal-relation-conflict`; reload or go to list |
| S103 | Status buttons; type + keyword; TINJAU/EDIT; approve/reject/update; "Unduh Data" | `GET /user-verification/:id/detail`, `POST /:id/{approve,reject,update}` | JSON `{success, message}` | Modals, toasts, `draw(false)`; Excel export with a fixed success toast |
| S084 | Branch filter; search type; toggle | `POST /user-management/:id/update-is-active` | Gateway JSON | Revert + `toastr.error` on failure |
| S096 | Shipment fee/detail forms; change courier; cancel | `POST /gpos-brand/:id/update-shipment-{fee,detail}`, `…/update-status-to-canceled` | Redirect | Flash; `resetInfoPengiriman()` |
| S095 | "Buat Voucher" → `#alertalldel` → `confirmCreate()` | `$('form').submit()` → `POST /gpos-brand/shipping-voucher/submit` | Redirect | Submits every form on the page [INFERRED] |
| S060 | Search, show, pagination; Aktif / Non Aktif | `GET /poin-voucher/list`; POST `update-status` | JSON / redirect | Cards; confirmation modals |
| S053/S055 | `#program_id` change; point basis; COMBINE_AND rows; tier rows; label mirroring | — | — | Shows the matching partial (others are hidden but still submitted); add/remove rows |
| S054/S056 | Simpan / Back | Modal forms with `status` ACTIVE / INACTIVE / DRAFT | Redirect | `#alertnext`, `#modal-draft` |
| S063 | Checkbox click switches the button target between `#alertdel`, `#alertalldel` and `#validationdel` (which is missing) | `DELETE /poin-voucher/inject-point`, `POST /poin-voucher/inject-point` | Redirect | — |
| S064 | "Cari" | Datatable `ajaxData` with all filters | JSON | Redraw |
| S066 | Toggle | `POST /voucher-setting/:code/update-is-active/:id?_method=PUT` | Raw result | Reload |
| S102 | `#addPrincipalModal` save gating; template download; branch CSV upload and validation | `POST /loyalty-member/card`, `/generate-csv`, `/validate-branch-csv`, `/files/signurl` | JSON | Toasts; reload |
| S098 | Search on Enter; `#getPointModal`; `#programTypeModal` | `GET /loyalty-member/:id/list`; `POST /loyalty-member/card/:id` | JSON / redirect | Cards; navigation |
| S099-S101 | Product modal; draft/publish; required check; CSV; back guard | Form POST store/update; `/gamification/upload-csv` | Redirect / JSON | Toasts; `#customAlert`; `beforeunload` |
| S087 | `validateUpload()`; every `<a>` click intercepted | — | — | `alert()`; `#modal-leave` |
| S003 | Image picker; Choices multi-select | — | — | Preview; empty options (the controller doesn't pass them) |
| Every image-upload view | `.image_uploader` change | `POST /files/signurl` → PUT to the signed URL | `{url, file_url}` | Hidden field + preview; size/ratio alerts (§16) |

---

## 10. Shared Legacy JS (A1.8)

| Legacy helper | Purpose | Screens using it | Trigger | Inputs | Effect | Endpoint |
|---|---|---|---|---|---|---|
| `$.fn.buildtable(url, columns, sort, filename, options, drawCallback, ajaxData, customOptions, initScript)` | DataTables factory | 32 views (§7) | Page load | url, columns, sort, filename, overrides | Server-side table, buttons, row handlers | `*/datatable` (POST; GET for Referral) |
| Select-all / row checkbox | Bulk selection | Lists with bulk delete | `#titleCheck`, row checkbox | — | Enables `item[]`; adds `table-select` class | — |
| `.alertdel` → `#alertdel` | Delete one row | Lists using `alertdel` | Click | Row id | Fills `#delid` and opens the modal | `*/delete` |
| `.new_alertdel` → `#new_alertdel` | Delete one row (RESTful) | customer_group, faqs, inventories, product_category, product_restrictions, products, sponsored_products | Click | `data-route` with `ID` | Rewrites the form action; opens the modal | `DELETE /<res>/:id` |
| `#alertalldel` + `#confirmdel` | Confirm bulk delete | 23 views | `show.bs.modal` | Closest form | Submits that form | `*/multidelete` |
| `.notification-cancel` / `.notification-final` | Notification actions | S009-S011 | Click | `notification-id` | Opens the matching modal | `/notification/{cancel,final}` |
| `sanitizeNumberInput`, `blockInvalidNumberKeys` | Numeric input guard | `form_number` (37 views) | input / keydown | Value | Keeps digits and one dot; blocks e/E/+/-; clamps negatives | — |
| `.alert` auto-hide | Dismiss flash messages | Global | Page load | — | Fades out after about 3.5 s | — |
| select2 init + `normalizeSelect2Data` | AJAX selects | About 38 views | `.select2[data-url]` | `term`, `data-field-id-name`, `data-callback`, `datas-template-result`, `datas-sorter`, `datas-empty-text` | Normalises results; id taken from fieldIdName → id → value → code → name → text | OPTIONS routes |
| "ALL" option | Select all options | S017, S009, S104, S103 | Select or unselect `ALL` | `data-url` | Selects everything (fetching it first if needed), or clears | OPTIONS route |
| `.checkbox-toggle` value | Toggle value as `'true'`/`'false'` | `form_toggle_switch` + 10 views | change | — | Value string | — |
| `.custom-timepicker` defaults | Timepicker | `form_timepicker` (S010/S011) | Init | — | 5-minute step, 24-hour | — |
| `.price-format`, `toIDR`, `toIDRWithoutCurrencyCode`, `.content-richtext` | Formatting / rich text | **Not used by any view** | — | — | — | — |
| Choices on `.select_multiple` | Multiselect | Commented out; only used inline in S003 | — | — | — | — |
| `showToastify` / `…Success` / `…Error` (`cms-toastify.js`) | Toast | 22 views | Inline calls, flash | text, options | 10 s toast at top centre | — |
| `$.fn.pagination` + `.draw()` (`pagination.js`) | Custom pager | S060, S088, S098 | List load | totalData, forcePage, showPerPage | "Showing …" text + page links → `onPageChange` | The caller fetches |
| `loadingModal` (vendor) | Loading overlay | 2 views | Inline | — | Spinner | — |
| Layout CSRF setup | CSRF header | Global | Load | `csrf_token` meta tag | `$.ajaxSetup` + `axios.defaults` header | — |
| Layout sidebar | Minimise; active link | Global | Click / load | `location.pathname` | Exact-match `active` class | — |

---

## 11. Form Inventory (A1.9) and Form Component Usage (A1.10)

### 11.1 Forms

Columns:
- **Sub**: how the form submits. N = native POST, A = AJAX.
- **Key fields**: legacy names. `*` marks a required marker or rule.

| Screen | Action (method, spoof) | Sub | Key fields | Validation | Success | Failure |
|---|---|---|---|---|---|---|
| S106 login | POST `/login` | N | email*, password* (**prefilled values present**) | Login | `session.put('auth')` → `/home` | `notification` → back |
| S003/S004 principal | POST `/principal` (multipart) / `?_method=PUT` | N | uplimages[] (create only), code*, name*, phone, fax, website, is_active, address | PrincipalCreateEdit | `notification` → `/principal` | withErrors, no old input; update failure uses the `Warning` key |
| S006 feedback | `?_method=PUT` (multipart) | N | Read-only customer/type/date; message (disabled); solution* | FeedbackEdit | → `/feedback` | `Warning` (not shown) |
| S008 order | `?_method=PUT` | — | All read-only; **no submit button** | OrderEdit | — | — |
| S010/S011 notification | `POST /notification/save` / `?_method=PUT` | A | title*, subtitle, deep_link, banner, thumbnail, product_ids, description; cust_id / customer_channel_ids / customer_area_ids (at least one required); push_notifcation_type ONETIME/SCHEDULED; flag_onetime; one_time_notification_date/time; schedule_start/end_date, schedule_time, schedule_days[]; save_as_draft | NotificationCreate/Edit + server checks | code 200 → `/notification` | code 300 → field errors; otherwise `#alert_notif` |
| S015/S016 global configuration | POST / PUT | N | key*, value* (the edit form pre-fills `value` with the key) | GlobalConfigurationCreateEdit | → list | `Warning` |
| S018/S019 banner | POST `/banner` / PUT (serialised) | A | is_active, type*, image / story_image, display_mode[], title*, sequence*, platform*, content_type*, link_url, start/end_date*, is_open_new_tab, content (Quill), type_channel_id, branch_id, cust_id | BannerCreate (edit has none) + client gating | Toast → edit page or list | JSON 400 toast |
| S019 "Katalog Produk" tab | POST `/custom-criteria/update_by_custom_type/BANNER` | N | principal_ids, product_ids, category_ids, catalog_ids, product_class_ids, therapeutic_class_ids, sub_therapeutic_class_ids, promo_codes, price_from, price_to | CustomCriteriaCreateEdit | Back + flash | `Warning` |
| S021/S022 group story | POST `/group-story` / PUT (JSON) | A | is_active, name*, thumbnail, sequence*, start_date*, end_date*, banner_ids | Manual server checks | Flash → list | Toast |
| S024/S025 referral code | POST `/referral-code` / `?_method=PUT` | N | status, is_active, referral_code*, agent_name*, global_quota*, start/end_date*, product_condition*, product_criteria, product_ids / product_codes, points_earned, min_purchase_active, min_purchase_amount, channel_id, previous_status | ReferralCode + validateDates | `notification` → list | withErrors + flashAll + `warning` toast |
| S027 custom catalog | POST `/custom-catalog` | N | name, sequence* | CustomCatalogCreate | → `/custom-catalog/:id/edit` | Silent back; on HTTP 400 the action does not return anything |
| S028 tabs | PUT catalog; POST CCPH; POST criteria (CUSTOM_CATALOG) | N | name*, sequence*, is_active / custom_catalog_id, product_id*, sequence* / criteria fields as in S019 | CustomCatalogEdit / CCPHCreate / CustomCriteriaCreateEdit | Back | `Warning` / silent |
| S030/S031 CCPH | POST / PUT | N | custom_catalog_id, product_id, sequence | CCPHCreate/Edit | Back / list | Silent |
| S037/S038 custom criteria | POST / PUT (update action undefined) | N | custom_catalog_id, product_id, sequence | CustomCriteriaCreateEdit (needs `custom_type`, so it always fails) | — | Silent |
| S040/S041 content | POST / PUT | N | code*, name*, is_active, value | ContentCreateEdit (errors not displayed) | → list | `warning` / `Warning` |
| S043/S044 FAQ | POST / PUT | N | category*, title*, detail* | FAQCreateEdit | → `/faqs` | `warning`; the category select loses `old()` |
| S046 product | PUT | N | image_thumb/front/back/side, code/name (disabled), description, term_and_condition, is_active | ProductEdit (only when active) | → `/products` | `warning` |
| S048/S049 product category | POST (multipart) / PUT | N | name*, image* (defaults to `'-'`), sequence* | ProductCategoryCreateEdit | → list | First message as `warning` |
| S107 tabs | POST `/global-configuration/updatebyproductgposb2b`; POST `/product-gposb2b-homepage`; POST criteria (PRODUCT_GPOSB2B) | N | title_*, image_* / product_id*, sequence* / criteria fields | — / PGHCreate / CustomCriteria | Back | `Warning` / silent |
| S053 → S054 → store | POST summary → POST store | N | program_title*, program_id*, fields per program type (§17), status | PoinSettingCreate + per-program validator | `notification` → setting-point | `warning[]` → back; entered values lost |
| S055 → S056 → update | POST summary → POST update | N | Same + program_type, point_type_name | + programTypeValidationMap | → setting-point | `warning[]` → edit |
| S062 → S061 → store | POST summary → POST store | N | customer_id*, changes_point*, inject_type*, changes_date*, changes_by*, point_type_id*, description* | InjectPointCreate | → inject list | withErrors / `warning` |
| S067 → S068 → store; S069 → S070 → update | POST summary → store/update | N | voucher_name*, point_redeem_category_id*, voucher_code*, amount*, min_point*, is_active | PoinVoucherCreate (store has none) | → `/voucher-setting/:code` | withErrors / `warning` |
| S073/S074 customer group | POST / PUT (JSON) | A | name (max 100), customer_ids (select or manual) | Manual server check | Flash → list | `#cg-form-error` |
| S076/S077 inventory | POST / PUT | N | product_id*, distributor_id*, hna_price* / hna_price* | InventoryCreate/Update | → list | First message as `warning` |
| S077 stock modal | POST / `?_method=PUT` | N | org_id*, stock*, warehouse_id*, expired_date*, is_active* | InventoryStockCreate/Update | Back | `warning` |
| S079/S080 sponsored product | POST / PUT | N | sponsor_type*, product_category_id (when CATEGORY), product_id*, sequence* | SponsoredProductCreateEdit | → list | `warning` |
| S082/S083 product restriction | POST / PUT | N | product_id*, type_channel_id* | Manual | → edit page or list | `warning` |
| S086 trigger receipt | POST `/payment/:id` | N | date | Manual | Always `notification` | `error` |
| S087 Folamil | POST `/register-folamil` (the value is an OSS URL) | N | file | Manual | `success` HTML | `warning` HTML |
| S090-S093 gamification | POST `/gamification` / PUT (JSON) + POST post-update | A | name*, active, order_channels, price_calculation_type, hold_criteria, banner, logo, description, terms_and_conditions, product_ids / product_codes, principal_ids, minimum_sku, timeline dates, periods[], program_type, reward_type, is_reward_at_start, rewards[] | GamificationCreateDraft / Edit* | toastr + redirect | Toasts + `is-invalid` |
| S095 shipping voucher | POST `/gpos-brand/shipping-voucher/submit` | N | judul_voucher*, nominal_voucher*, kuota_voucher*, start_date*, end_date* | GposBrandShipppingVoucherCreate | `success` → list | `warning` |
| S096 order processing | POST update-shipment-fee / update-shipment-detail / cancel | N | delivery_fee_amount, delivery_fee_discount_amount / driver_name, driver_phone, shipping_method_name, delivery_link / description | Manual | Detail page | `warning` |
| S099-S101 loyalty program | POST store / POST `/:id/update` | N | program_name, description, poin, is_active, is_max_point_in_month, pmax_point, product_id[], qty[], product_name[], start/end_date, kuota, file, enabled | Store: none; update: LoyaltyMemberCreate | → `/loyalty-member/:id` | `warning` toast / flashAll |
| S102 add-principal modal | POST `/loyalty-member/card` (axios, multipart) | A | title*, code*, principal_ids*, enable_branch_location, file | Client gating | Toast + reload | Toast |
| S098 "Cara Dapat Poin" modal | POST `/loyalty-member/card/:id` | N | content (Quill), title, principal_ids, code | — | `success` (never displayed) | `error` (never displayed) |
| S103 review / edit modals | POST approve / reject / update (JSON) | A | active_start_at, active_end_at | Client date checks | Toast | Toast |
| S104 add-channel modal | POST `/personalization/channels/create` | N | title | Client required check | → `/personalization/channels/:id` | `warning` → back |
| S105 channel wizard | POST `/personalization/channels/:id` (serialised, `_method=PUT`) + product modal | A | name*, is_active, type_channel_id / customer_group_id / cust_id, content toggles; product criteria | ChannelUpdate | Reload or list | Toast / conflict modal |

### 11.2 Edge component usage (22 components)

| Component | Uses | Views | Example fields |
|---|---|---|---|
| form_date | 42 | 16 | start_date, end_date, registration_start_at, registration_end_at, registration_extended_at, claim_reward_start_at, claim_reward_end_at, claim_reward_extended_at |
| form_datetimepicker | 8 | 4 | combination_and_start_date, combination_and_end_date, combination_or_start_date, combination_or_end_date, program_bertingkat_start_date, program_bertingkat_end_date, single_item_start_date, single_item_end_date |
| form_image | 28 | 17 | image, story_image, physical_reward_image, banner, logo, file, file-progress, thumbnail |
| form_number | 60 | 37 | sequence, price_from, price_to, physical_reward_coupon_amount, voucher_reward_coupon_amount, minimum_sku, delivery_fee_amount, delivery_fee_discount_amount |
| form_radio | 4 | 2 | flag_onetime |
| form_select | 33 | 25 | type, content_type, category, voucher_reward_title, program_type, reward_type, price_calculation_type, hold_criteria |
| form_select2 | 7 | 7 | product_id, satuan, category_ids |
| form_select2_custom | 14 | 11 | custom_catalog_id, product_id, product_ids, customer_id, combination_and_product_ids[], single_item_product_id |
| form_select_multiple | 85 | 26 | platform, type_channel_id, branch_id, cust_id, principal_ids, product_ids, category_ids, catalog_ids |
| form_text | 83 | 44 | title, author, custom_catalog_id, product_id, name, physical_reward_title, id, key |
| form_text_icon | 2 | 2 | Cari |
| form_textarea | 21 | 18 | cust_id, detail, description, terms_and_conditions, product_codes, aam_customer_ids, combination_and_description, combination_or_description |
| form_texteditor_quill | 3 | 3 | content |
| form_time | 0 | 0 | - |
| form_timepicker | 4 | 2 | one_time_notification_time, schedule_time |
| form_toggle_switch | 30 | 26 | is_active, is_open_new_tab, is_instant_reward, is_reward_at_start, active, is_registration_period_enabled, is_max_point_in_month, enable_branch_location |
| form_url | 2 | 2 | link_url |
| list_paginate | 0 | 0 | - |
| loyalty_card | 1 | 1 |  |
| mobile_app_preview | 0 | 0 | - |
| mobile_app_search_preview | 1 | 1 |  |
| paginate | 0 | 0 | - |

**Parameters and validation behavior.** In the last column:
- `old`: the value is refilled from `old()`.
- `err`: always renders `getErrorFor`.
- `err*`: renders `getErrorFor` only when `showError` is passed.
- `border`: `hasErrorFor` adds a red border.

| Component | Purpose | Parameters | Validation behavior |
|---|---|---|---|
| form_text | Text input | labelClass, label, field, value, inputClass, placeholder, disabled, description, showError | old, border, err* |
| form_number | Number input with sanitiser | the above + allowNegative, fieldInfo | old, border, err* |
| form_textarea | Textarea | labelClass, label, field, value, inputClass, disabled, showError | old, border, err* |
| form_date | `type=date` | + max, min | old, border, err* |
| form_datetimepicker | gijgo read-only datetime | field, value, inputClass, disabled | old, err |
| form_time | `type=time` | — | old, err (not used anywhere) |
| form_timepicker | bootstrap-timepicker | field, value | old, err |
| form_select | Static select | options[{value,label}], value, placeholder, fieldInfo | err; **does not use old()** |
| form_select2 | AJAX select2 | label, selected, url, field, id, multiple | None |
| form_select2_custom | AJAX select2 with a preset value | url, field, id, emptyText (emitted as `data-empty-text`, but `main.js` reads `datas-empty-text`), valueAjax | None |
| form_select_multiple | Multi-select2 | field, className, url, placeholder, callbackData, templateResult, closeOnSelect, sorter, fieldIdName, emptyText, listOptions, value[], valueAjax[] | None |
| form_radio | Radio | value, checked, style | old, err |
| form_toggle_switch | bootstrap-toggle checkbox | labelOn, labelOff, readonly, value | err; no old() |
| form_url | Link input (`type=text`) | — | old, err |
| form_image | OSS upload | label, field, value, inputClass, maxSizeMessage, accept, imageClass, showError | border, err*; the label prints `-- {{value}}` (looks like a debug leftover) |
| form_text_icon | Text input with raw prepend/append HTML | prepend, append | old, err |
| form_texteditor_quill | Quill editor + hidden input | field, value (raw HTML) | err |
| loyalty_card | Card with a "Lihat" link | title, description, id | — |
| mobile_app_preview | Static phone mock (Swiper from CDN) | productGposB2B | — (pulled in with `@include`) |
| mobile_app_search_preview | Static search mock | — | — |
| list_paginate, paginate | Server-side pagination partials | — | LIKELY UNUSED (§24) |

---

## 12. Modal / Dialog Inventory (A1.11)

There are 55 distinct modal dialogs plus one loading overlay. Only `#alertalldel` is global (`layouts.edge:230`); every other modal is defined in its own view.

| Modal | Screens | Trigger | Class | Action / API | Close |
|---|---|---|---|---|---|
| `#alertalldel` | Bulk-delete lists; S094 (body rewritten by JS); S095 | Footer/header button | Confirmation | Submits the enclosing form / cancel link / `confirmCreate()` | Dismiss |
| `#alertdel` | S002, S005, S007, S014, S017, S026, S028, S029, S036, S039, S063, S107; leftover copies in S019 and S084 | `.alertdel` | Confirmation | POST `*/delete {id}`; S063 uses DELETE on inject-point | Dismiss |
| `#new_alertdel` | S042, S045 (dead), S047, S072, S075, S078, S081 | `.new_alertdel` | Confirmation | `DELETE /<res>/:id` | Dismiss |
| `#validationdel` | S017, S026 (S063 and S084 reference it but it is missing or dead there) | Bulk button with nothing selected | Alert | — | Dismiss |
| `#modaldev` | S065 | Nothing opens it | Alert | — | — |
| `#manualtrigger` | S086 | Trigger Receipt | Form | POST `/payment/:id` | Batalkan |
| `#istock-modal` | S077 | New / edit stock | Form | store / update | Close |
| `#tsc-modal-delete`, `#tsc-modal-bulk-delete` | S023 | Row delete / bulk delete | Confirmation | `DELETE /referral-code/:id`, `DELETE /referral-code` | Dismiss |
| `#cg-alertalldel` | S072 | Bulk delete | Confirmation | `DELETE /customer-groups` | Dismiss |
| `#modal-add-channel` | S104 | Tambah | Form | POST `…/create` | Dismiss |
| `#modal-delete` | S104 | Row delete | Confirmation | axios DELETE | Dismiss |
| `#modal-confirm-publish` | S105 | Save while publishing or deactivating | Confirmation | POST update | Dismiss |
| `#modal-add-product` | S105 | Add / edit product | Form (cascading selects) | POST `…/products/save` | Dismiss |
| `#modal-confirm-delete-product` | S105 | Delete | Confirmation | DELETE products | Dismiss |
| `#modal-relation-conflict` | S105 | A 400 conflict response | Detail / alert table | — | Dismiss |
| `#modal-new-group` | S105 | Its trigger is commented out | Form (unreachable) | Posts to `/cms/personalization/customer-groups`, which has no route | — |
| `#reviewModal`, `#editModal`, `#rejectConfirmModal` | S103 | TINJAU / EDIT / Tolak | Detail + form / form / confirmation | approve / update / reject | Dismiss |
| `#modal-leave` | S087 | Any `<a>` click | Confirmation | Dismiss only | — |
| `#penggantianKurirModal`, `#konfirmasiPembatalanModal` | S096 | Ganti Kurir / Batalkan | Confirmation / form | Reset fields / POST cancel | Dismiss |
| `#gs-alertdel`, `#gs-alertalldel`, `#gs-discard-modal` | S020, S021 | Delete / bulk / Kembali | Confirmation | DELETE / multidelete / leave page | Dismiss |
| `#notification-cancel-modal`, `#notification-final-modal`, `#notification-delete-modal` | S009, S011 | Dropdown / header buttons | Confirmation | `/notification/{cancel,final,delete}` | Dismiss |
| `#notification-publish-modal` | S010, S011 | Publish (ONETIME) | Confirmation | Submits the form | Dismiss |
| `#notification-preview-modal` | S010, S011 | Preview | Custom popup (phone mock) | — | Dismiss |
| `#notification-changeupdate-modal` | S010, S011 | `beforeunload` | Confirmation | — | — |
| `#voucher-reward-modal`, `#physical-reward-modal` | S090-S093 | "+ Hadiah" | Form (custom) | Updates the client-side `rewardList` | Dismiss |
| `#confirm-reward-at-start-modal`, `#confirm-cancel-mission-modal`, `#confirm-erase-mission-modal`, `#confirm-save-and-activate-mission-modal`, `#required-fields-modal` | S088, S090-S093 | Toggles, back, delete, save, duplicate | Confirmation | Varies | Dismiss |
| `#confirm-cancel-active-mission-modal` | S088 | Never added to the menu | Confirmation (unreachable) | `PUT /gamification/:id/update-status` | — |
| `#csv-data-modal`, `#csv-progress-modal` | S092/S093 | History link | Detail | — | Dismiss |
| `#loading-overlay` | S092/S093 | Save | Loading | — | Automatic |
| `#add-new-period` | S091 | Add period | Form | Client-side only | Dismiss |
| `#alertupdatestatusactive`, `#alertupdatestatusinactive` | S060 | Aktif / Non Aktif | Confirmation | POST update-status | Dismiss |
| `#alertnext`, `#modal-draft` | S054, S056 (draft is unreachable on S056), S068 | Simpan / Back | Confirmation | POST store/update with `status` | Dismiss |
| `#alertpreview` | Poin/voucher summaries | Preview | Custom popup | — | Dismiss |
| `#exit-inject-point`, `#save-inject-point` | S062, S061 | Back / Simpan | Confirmation | Go to list / POST store | Dismiss |
| `#addPrincipalModal` | S102 | Tambah Principal | Form | POST `/loyalty-member/card` | Dismiss |
| `#getPointModal`, `#programTypeModal` | S098 | Buttons | Form / chooser | POST card / navigation | Dismiss |
| `#addProductModal`, `#customAlert` | S099-S101 | Product, publish, back, delete | Form / confirmation | Client-side / submit | Dismiss |
| SweetAlert `swal()` | 2 views | Inline | Alert | — | — |
| Native `confirm()` / `alert()` | S077, S087, the uploader, S104 | Inline | Alert / confirmation | — | — |

---

## 13. Navigation Inventory (A1.12)

These visibility conditions are not permissions; A2 decides what they mean. `layouts.edge:141-156` renders each group heading (except "Dashboard") and only renders children whose `visibility` is truthy. Links are built with `route(c.route_handler)`.

| Menu set (condition) | Group | Label | route_handler | URL | Icon | visibility | Rendered? | Evidence |
|---|---|---|---|---|---|---|---|---|
| menuPayment (auth.user_email == admin-payment account) | Dashboard | Dashboard | HomeController.home | `/home` | fa fa-home | (undefined) | NO (layouts.edge:147 renders only visibility=true) | Extender.js |
| menuPayment (auth.user_email == admin-payment account) | Menu | Pembayaran | PaymentController.index | `/payment` | fa fa-money-bill | true | YES | Extender.js |
| menuMarketing (auth.user_email == admin-marketing account) | Dashboard | Dashboard | HomeController.home | `/home` | fa fa-home | (undefined) | NO (layouts.edge:147 renders only visibility=true) | Extender.js |
| menuMarketing (auth.user_email == admin-marketing account) | Menu | Push Notification | NotificationController.index | `/notification` | fa fa-bell | true | YES | Extender.js |
| menuMarketing (auth.user_email == admin-marketing account) | Menu | Banner | BannerController.index | `/banner` | fa fa-indent | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Dashboard | Beranda | HomeController.home | `/home` | fa fa-home | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Transaksi | Order/Pesanan | OrderController.index | `/order` | fa fa-clipboard | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Transaksi | Order Review | OrderReviewController.index | `/order-review` | fa fa-heartbeat | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Transaksi | Pembayaran | PaymentController.index | `/payment` | fa fa-money-bill | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Transaksi | Inventory/Persediaan | InventoryController.index | `/inventories` | fa fa-sitemap | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Produk & Katalog | Produk | ProductController.index | `/products` | fa fa-database | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Produk & Katalog | Kategori Produk | ProductCategoryController.index | `/product-category` | fa fa-tags | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Produk & Katalog | Produk Gpos B2b | ProductGposb2bController.index | `/product-gposb2b` | fa fa-indent | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Produk & Katalog | Personalisasi Katalog | CustomCatalogController.index | `/custom-catalog` | fa fa-indent | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Produk & Katalog | Pembatasan produk | ProductRestrictedController.index | `/product-restrictions` | fa fa-ban | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Loyalty Member | LoyaltyMemberController.index | `/loyalty-member` | fa fa-star | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Poin & Voucher | PoinVoucherController.index | `/poin-voucher` | fa fa-gift | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Push Notification | NotificationController.index | `/notification` | fa fa-bell | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Banner & Iklan | BannerController.index | `/banner` | fa fa-indent | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Group Story | GroupStoryController.index | `/group-story` | fa fa-plus-circle | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Produk Sponsor | SponsoredProductController.index | `/sponsored-products` | fa fa-rocket | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Gamification | GamificationController.index | `/gamification` | fa fa-chess | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | Voucher Pengiriman | GposBrandShippingVoucherController.index | `/gpos-brand/shipping-voucher` | fa fa-indent | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Interaksi Pelanggan | GPOS Brand | GposBrandController.index | `/gpos-brand` | fa fa-rss | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Kode Telesales | ReferralCodeController.index | `/referral-code` | fa fa-headset | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Grup Pelanggan | CustomerGroupController.index | `/customer-groups` | fa fa-users | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Konfigurasi Channel | PersonalizationChannelController.index | `/personalization/channels` | fa fa-rss | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Verifikasi Akun | UserVerificationController.index | `/user-verification` | fa fa-user-plus | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Prinsipal | PrincipalController.index | `/principal` | fa fa-building | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Pendaftaran Folamil | RegisterFolamilController.index | `/register-folamil` | fa fa-indent | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Konfigurasi Umum | GlobalConfigurationController.index | `/global-configuration` | fa fa-indent | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Pengaturan & Konfigurasi | Manajemen Pengguna | UserManagementController.index | `/user-management` | fa fa-user | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Bantuan Pengguna | Masukan | FeedbackController.index | `/feedback` | fa fa-rss | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Bantuan Pengguna | Konten | ContentController.index | `/content` | fa fa-file | true | YES | Extender.js |
| menuSuperadmin (any other session (default)) | Bantuan Pengguna | FAQ | FAQController.index | `/faqs` | fa fa-question | true | YES | Extender.js |

**Layout navigation** [SOURCE `layouts.edge`]:

| Element | Location | Target | Notes |
|---|---|---|---|
| Brand logo | Sidebar | `/` | Redirects to `/home` when logged in |
| Mobile "My profile" | `ul.d-md-none` (:86) | `route('UserController.getMyProfile')` | **Handler does not exist**; the href is probably `"null"` [INFERRED; VERIFY A3] |
| Mobile "Logout" | :103 | `route('UserController.getLogout')` | **Handler does not exist** |
| Mobile placeholders | :66-71 | `#` | "Action / Another action / Something else here"; `{{ fullname }}` is never shared with the view, so it is empty |
| Desktop "Account" → Logout | :219 | `/logout` | Works |
| Commented-out dashboard link | :190 | `route('HomeController.getDashboard')` | Inside an HTML comment, but Edge still evaluates it |
| Sidebar minimise | `#minimize-sidebar` | Client-side | Toggles CSS classes |
| Active link highlight | :306-310 | `href == location.pathname` | Exact match only, so sub-pages don't highlight |

**Screens with no navigation entry.** These are reached only by URL or by links inside other pages [SOURCE]:
- S029-S031, S033-S038
- S050-S052, S057, S058 (mockups)
- S061-S064, S066-S071 (hub cards commented out)
- S091 (multi-period type card commented out)

---

## 14. Dashboard / Home (A1.13)

| Widget | Data source | Endpoint | Chart | Metric | Filter | Evidence |
|---|---|---|---|---|---|---|
| "Page Total" | None | None | — | Hardcoded `formatRupiah(0)` | — | `dashboard.edge:17` |
| "Article Total" | None | None | — | Hardcoded `{{0}}` | — | `dashboard.edge:55` |
| "Overview / Visitors" | None: `drawSalesChart()` returns `false` immediately | Dead reference to `route('SalesOrderController.getSalesChart')`; that controller doesn't exist | Chart.js `#myChart`, never drawn | — | WEEK / MONTH / YTD buttons have no effect | `dashboard.edge:247-287` |
| Commented-out cards and tables | Undefined variables `capital`, `purcasedItem`, `topselling`, `dailyIncome` | — | — | — | — | Still evaluated inside comments [INFERRED] |

- `HomeController.home` renders the view with no data (`HomeController.js:5-7`).
- The Superadmin menu shows "Beranda". In the Payment and Marketing sets the "Dashboard" child has no `visibility`, so it is not rendered.

## 15. Profile / Account (A1.14)

| Screen | Route | View | Fields / actions | Auth dependency | Session behavior | Evidence |
|---|---|---|---|---|---|---|
| Login (S106) | GET `/` | `login.edge` (standalone) | email, password (**prefilled values present; do not carry over**); "Forgot password?" is `#` | None | A valid session redirects to `/home`. An expired session is not cleared | `AuthController.js:9-16`, `login.edge:45-75` |
| Login submit | POST `/login` | — | Login validator | Gateway `POST /api/v1/auth/login` | Success: `session.put('auth', login.data)` (payload shape is for A2). Failure: `notification` → back, no old input | `AuthController.js:18-34` |
| Logout | GET `/logout` | — | — | Gateway `POST /api/v1/auth/logout`; the result is ignored | `session.clear()` → `/` | `AuthController.js:36-40` |
| Session gate | Every `authSession` route | — | — | `checkAuth` compares the `expires_at` string with now | Missing or expired → redirect to `/`. No token refresh | `AuthSession.js`, `Authorization.js` |
| Per-action fallback | Most controllers | `login` | — | `checkAuth` is called again inside the action | Renders the login view in place; the URL stays the same [INFERRED] | ctrl.json `loginFallback` |
| Profile / change password | **None exist** | — | The layout links to missing `UserController.*` handlers [UNKNOWN — A3] | — | — | grep |

## 16. Upload / File Inventory (A1.15)

**Signed-URL flow** [SOURCE `includes/script_image_uploader.edge`, `FileController.signURL`, `Validators/FileSignURL`]:
1. When a `.image_uploader` input changes, the file size is checked against 5 MB.
2. The file name is sanitised.
3. An optional `data-ratio` check runs. It is asynchronous, so it does not actually block the upload [INFERRED].
4. `POST /files/signurl {file_name, category:'images', content_type}` goes to the gateway `/api/v1/files/signurl`, which returns `{url, file_url}`.
5. The browser sends a `PUT` of the raw file to `url`.
6. The hidden `.image_field` is set and `#preview-{field}` is updated. A fallback URL is built from `env('OSS_BUCKET_URL')`, so that value is exposed in page JS.
7. Errors only go to `console.error`.

| Screen | File type | Trigger | Backend | Storage | Preview | Validation |
|---|---|---|---|---|---|---|
| S018/S019 banner | image, story_image | form_image | signurl | OSS | Yes | 5 MB; 9:16 ratio for PRODUCT_ADS |
| S021/S022 group story | thumbnail | form_image | signurl | OSS | Yes | 5 MB |
| S010/S011 notification | banner, thumbnail | form_image | signurl | OSS | Yes | 5 MB |
| S090-S093 gamification | banner, logo, physical reward image; CSV `file` / `file-progress` | form_image | signurl → `/gamification/upload-csv*` | OSS | Images only | 5 MB; CSV checked on the server |
| S046 product | image_thumb / image_front / image_back / image_side | form_image | signurl | OSS | Yes | ProductEdit |
| S048/S049 product category | image | form_image | signurl | OSS | Yes | Required (defaults to `'-'`) |
| S107 Produk Gpos B2b | image_value | form_image | signurl | OSS | Yes | — |
| S067/S069 voucher category | image (hand-written uploader markup) | `.image_uploader` | signurl | OSS | Yes | — |
| S102 add principal | Branch CSV | form_image (`.csv`) | signurl → `/loyalty-member/validate-branch-csv` | OSS | — | Server checks headers |
| S099/S100 loyalty voucher program | Voucher CSV | form_image | signurl → `/gamification/upload-csv` | OSS | — | Server |
| S101 loyalty edit | CSV | **Uploader script not included** | — | — | — | Probably cannot set the file [INFERRED] |
| S087 Folamil | CSV | form_image | signurl → POST `/register-folamil` (sends the URL) | OSS | — | Client `validateUpload()` |
| S003 principal create | image `uplimages[]` | Hidden file input | **Multipart `POST /principal`** → local `public/images` | Local disk | FileReader | Image, 2 MB; update ignores the image |

`public/downloads/**`, `public/uploads/**` and `public/images/**` have no reference in source (A0-F10). The one exception is principal images, which are written at runtime.

## 17. Validation Inventory (A1.16)

**Server validators.** These use `@adonisjs/validator` and are called manually with `validate` or `validateAll`.

| Validator file | Rules (field=rule) | Messages | Used by (Controller.action; resolved by require name) |
|---|---|---|---|
| BannerCreate.js | title=required; sequence=required | 2 | BannerController.store |
| BannerEdit.js | dynamic (getRules()/commented) — see §17 notes | 0 | BannerController.update |
| ContentCreateEdit.js | code=required; name=required | 2 | ContentController.store, ContentController.update |
| CustomCatalogCreate.js | sequence=required | 1 | CustomCatalogController.store, CustomCatalogController.update, CustomCatalogProductHomepageController.store, CustomCatalogProductHomepageController.update |
| CustomCatalogEdit.js | name=required; sequence=required | 2 | CustomCatalogController.store, CustomCatalogController.update, CustomCatalogProductHomepageController.store, CustomCatalogProductHomepageController.update |
| CustomCatalogProductHomepageCreate.js | custom_catalog_id=required; product_id=required; sequence=required | 3 | CustomCatalogController.store, CustomCatalogController.update, CustomCatalogProductHomepageController.store, CustomCatalogProductHomepageController.update |
| CustomCatalogProductHomepageEdit.js | sequence=required | 1 | CustomCatalogController.store, CustomCatalogController.update, CustomCatalogProductHomepageController.store, CustomCatalogProductHomepageController.update |
| CustomCriteriaCreateEdit.js | custom_type=required | 1 | CustomCriteriaController.store, CustomCriteriaController.updateByCustomType |
| DateComparison.js | dynamic (getRules()/commented) — see §17 notes | 0 | see controller require (§17) |
| FAQCreateEdit.js | title=required; category=required; detail=required | 3 | FAQController.store, FAQController.update |
| FeedbackEdit.js | solution=required | 1 | FeedbackController.update |
| FileSignURL.js | file_name=required | 1 | FileController.signURL |
| GamificationCreateDraft.js | dynamic (getRules()/commented) — see §17 notes | 9 | GamificationController.store, GamificationController.update |
| GamificationEditMultiTimeline.js | dynamic (getRules()/commented) — see §17 notes | 7 | GamificationController.store, GamificationController.update |
| GamificationEditProgram.js | dynamic (getRules()/commented) — see §17 notes | 9 | GamificationController.store, GamificationController.update |
| GamificationEditReward.js | program_type=required_when:status,ACTIVE; reward_type=required_when:status,ACTIVE; rewards=required_when:status,ACTIVE | 3 | GamificationController.store, GamificationController.update |
| GamificationEditSingleTimeline.js | dynamic (getRules()/commented) — see §17 notes | 13 | GamificationController.store, GamificationController.update |
| GlobalConfigurationCreateEdit.js | key=required; value=required | 2 | GlobalConfigurationController.store, GlobalConfigurationController.update |
| GposBrandShipppingVoucherCreate.js | judul_voucher=required; nominal_voucher=required; kuota_voucher=required; start_date=required; end_date=required | 5 | GposBrandShippingVoucherController.submitVoucher |
| InventoryCreate.js | product_id=required; distributor_id=required; hna_price=required | 3 | InventoryController.store |
| InventoryStockCreate.js | org_id=required; stock=required; expired_date=required; is_active=required; warehouse_id=required | 5 | InventoryStockController.store, InventoryStockController.update |
| InventoryStockUpdate.js | stock=required; expired_date=required; is_active=required; warehouse_id=required | 5 | InventoryStockController.store, InventoryStockController.update |
| InventoryUpdate.js | hna_price=required | 1 | InventoryController.update |
| Login.js | email=required; password=required | 2 | AuthController.postLogin |
| LoyaltyMemberCreate.js | program_name=required; description=required_when:enabled,true; poin=required_when:enabled,true; pmax_point=required_when:enabled,true; product_id=required_when:enabled,true; qty=required_when:enabled,true; product_name=required_when:enabled,true; start_date=required_when:enabled,true; end_date=required_when:enabled,true | 9 | LoyaltyMemberController.putProgramDetailByPrincipal |
| NotificationCreate.js | title=required | 1 | NotificationController.store, NotificationController.save, NotificationController.update |
| NotificationEdit.js | title=required | 1 | NotificationController.store, NotificationController.save, NotificationController.update |
| OrderEdit.js | order_status=required | 1 | OrderController.update |
| Personalization/ChannelCreate.js | name=required\|max:100 | 2 | see controller require (§17) |
| Personalization/ChannelUpdate.js | name=required\|max:100 | 2 | PersonalizationChannelController.update |
| PoinSetting/InjectPointCreate.js | changes_by=required; changes_date=required; changes_point=required; customer_id=required; description=required; inject_type=required; point_type_id=required | 7 | PoinVoucherController.createInjectPointSummary, PoinVoucherController.storeInjectPointSummary, PoinVoucherController.store |
| PoinSetting/PoinSettingCombineAndCreate.js | program_title=required; program_id=required; combination_and_description=required; combination_and_end_date=required; combination_and_start_date=required; combination_and_total_point=required; program_trigger_type=required | 7 | PoinVoucherController.createBonusPointProgramSummary |
| PoinSetting/PoinSettingCombineOrCreate.js | program_title=required; program_id=required; combination_or_description=required; combination_or_end_date=required; combination_or_start_date=required; combination_or_product_ids=required; combination_or_min_transaction=required; combination_or_total_point=required; program_trigger_type=required | 9 | PoinVoucherController.createBonusPointProgramSummary |
| PoinSetting/PoinSettingCreate.js | program_id=required | 1 | PoinVoucherController.createBonusPointProgramSummary |
| PoinSetting/PoinSettingCustomCreate.js | program_title=required; program_id=required; program_bertingkat_description=required; program_bertingkat_end_date=required; program_bertingkat_start_date=required; program_bertingkat_process_date=required; program_bertingkat_product_ids=required | 7 | PoinVoucherController.createBonusPointProgramSummary |
| PoinSetting/PoinSettingFolamilUpdate.js | min_qty=required; point=required; product_id=required | 3 | see controller require (§17) |
| PoinSetting/PoinSettingPaymentUpdate.js | description=required; min_transaction=required; point=required | 3 | see controller require (§17) |
| PoinSetting/PoinSettingRegularUpdate.js | min_transaction=required; point=required; description=required | 3 | see controller require (§17) |
| PoinSetting/PoinSettingSingleItemCreate.js | program_title=required; program_id=required; single_item_description=required; single_item_end_date=required; single_item_total_point=required; single_item_start_date=required; single_item_product_id=required; single_item_min_qty=required_when:single_item_point_baseon:BASED_QTY; single_item_min_transaction=required_when:single_item_point_baseon:BASED_TRX; program_trigger_type=required | 10 | see controller require (§17) |
| PoinSetting/PoinVoucherCreate.js | voucher_code=required; voucher_name=required; amount=required; min_point=required; point_redeem_category_id=required | 5 | PoinVoucherSettingVoucherController.createVoucherSummary, PoinVoucherSettingVoucherController.editVoucherSummary |
| PrincipalCreateEdit.js | code=required; name=required | 2 | PrincipalController.store, PrincipalController.update |
| ProductCategoryCreateEdit.js | name=required; image=required; sequence=required | 3 | ProductCategoryController.store, ProductCategoryController.update |
| ProductEdit.js | description=required; image_thumb=required; is_active=required | 3 | ProductController.update |
| ProductGposb2bHomepageCreate.js | product_id=required; sequence=required | 2 | ProductGposb2bController.update, ProductGposb2bHomepageController.store, ProductGposb2bHomepageController.update |
| ProductGposb2bHomepageEdit.js | sequence=required | 1 | ProductGposb2bController.update, ProductGposb2bHomepageController.store, ProductGposb2bHomepageController.update |
| ReferralCode.js | referral_code=required\|alphaNumeric; agent_name=required; global_quota=required\|integer; points_earned=requiredWhen:status,ACTIVE\|integer; start_date=required; end_date=required; product_ids=requiredWhen:product_ids_required_flag,yes; product_codes=requiredWhen:product_codes_required_flag,yes; product_condition=requiredWhen:product_ids_required_flag,yes\|requiredWhen:product_codes_required_flag,yes; min_purchase_amount=requiredWhen:min_purchase_active,true\|above:0 | 13 | ReferralCodeController.store, ReferralCodeController.update |
| SponsoredProductCreateEdit.js | product_id=required; sponsor_type=required; product_category_id=requiredWhen:sponsor_type,CATEGORY; sequence=required | 4 | SponsoredProductController.store, SponsoredProductController.update |

**Dynamic validators** [SOURCE]:
- **`GamificationCreateDraft.getRules(program)`:**
  - `name` is required.
  - For multi-period programs: registration start/end, claim start (unless the reward is instant), claim end, and each `periods.N.{name,start_at,end_at}`.
  - `minimum_sku` must be in the range 0 to the number of products + 1.
- **`GamificationEditProgram`:** `name` is required. When the status is ACTIVE, `required_when` applies to order_channels, price_calculation_type, banner, description, terms_and_conditions, hold_criteria, product_or_principal and minimum_sku (plus its range).
- **`GamificationEditSingleTimeline` / `…MultiTimeline`:** chains of `required_when` / `after` rules (registration → program → claim; the extended date must be after the end date).
- **`BannerEdit`:** every rule is commented out.
- **`PoinVoucherHelper.programIdValidationMap` / `programTypeValidationMap`:** pick the PoinSetting* validator to run.
- **`DateComparison`:** a custom rule that exists, but where it is used is not confirmed.

**Manual cross-field checks on the server** [SOURCE]:

| Feature | Check |
|---|---|
| Referral | `validateDates`: DD/MM/YYYY format, start must be on or before end |
| Bonus point | start < end, but only checked on the `single_item_*` dates |
| Notification | At least one relation; start ≤ end; schedule days and time required |
| Group Story | Start not before today; end ≥ start |
| Shipping voucher | Nominal and quota must not be negative |
| Product restriction | Product and channel required |
| Customer group | Name and customer IDs required |
| Payment trigger | Date required |
| Product | Only validated when `is_active != '0'` |

**Client-side validation:**
- `.validate(` (jquery-validation) is called in 26 files.
- The save button is disabled until fields are complete on Banner, Group Story, Referral, Customer Group, Loyalty and Channel.
- Regex checks: the Gamification name, Customer Group manual IDs, and the driver phone number.
- Date min/max linking and upload size/ratio checks.

**How errors are displayed.** Most field components only show the message when `showError` is passed, which is rare, so usually only a red border appears. Content code/name errors are never displayed. The FAQ category select loses its `old()` value.

## 18. Redirect / Flash / Error Behavior (A1.17)

**Flash keys:**
- `notification` is used for success and info.
- `warning` is used for failures.
- Other keys in use: `Warning` (capital W, **never rendered**), `error`, `success`, `success_temporary`, `warning_temporary`, `error_validation`, `success_toast`.
- List pages usually render only `notification`, sometimes `warning`.

**Validation failures.**
- The usual path is `session.withErrors(messages)` (sometimes with `flashAll`) followed by `redirect('back')`.
- Some actions flash only the first message, as `warning`.
- `old()` values are restored only where `flashAll` or `flashExcept` is used.

**JSON endpoints.** These answer `{code|success, message}`:
- Banner, Group Story, Notification, Gamification.
- Customer Group, Channel, User Verification, Loyalty card.
- Several of them answer failures with `redirect('back')`, which sends HTML back to an AJAX caller.

**Datatable errors.** `catch` blocks call `flash` and then `redirect('back')`. This probably breaks the table draw [INFERRED].

**Auth fallback.**
- Actions call `view.render('login')` when `checkAuth` fails.
- In several `datatable` and `store` actions `view` is not destructured, so this would throw a ReferenceError [INFERRED].

**Other response helpers.**
- The `response.api` macro is defined but hardly used.
- `response.send` is used 68 times.

**Per-route redirect and flash behavior:**

| Method | URL | Handler | Validator | Response kinds | Redirect targets (first 4) | Flash | back() |
|---|---|---|---|---|---|---|---|
| POST | `/login` | AuthController.postLogin | Login.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/home' | flash,notification | YES |
| GET | `/logout` | AuthController.getLogout | - | redirect | redirect:'/' | - | - |
| POST | `/principal/delete` | PrincipalController.delete | - | redirect | redirect:'/custom-catalog' | flash,notification,warning | - |
| POST | `/principal/multidelete` | PrincipalController.multidelete | - | redirect | redirect:'/principal' ; redirect:'/principal' | flash,notification,warning | - |
| POST | `/principal` | PrincipalController.store | PrincipalCreateEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' ; redirect:'/principal' | withErrors,flash,warning,notification | YES |
| PUT|PATCH | `/principal/:id` | PrincipalController.update | PrincipalCreateEdit.rules | redirect | redirect:'back' ; redirect:'/principal' ; redirect:'back' | withErrors,flash,notification,Warning | YES |
| PUT|PATCH | `/feedback/:id` | FeedbackController.update | FeedbackEdit.rules | redirect | redirect:'back' ; redirect:'/feedback' ; redirect:'back' | withErrors,flash,notification,Warning | YES |
| POST | `/feedback/delete` | FeedbackController.delete | - | redirect | redirect:'/feedback' ; redirect:'/feedback' | flash,notification,warning | - |
| POST | `/feedback/multidelete` | FeedbackController.multidelete | - | redirect | redirect:'/feedback' ; redirect:'/feedback' ; redirect:'/feedback' | flash,notification,warning | - |
| PUT | `/order/:id/sync-status` | OrderController.syncStatus | - |  | - | flash,warning | - |
| PUT|PATCH | `/order/:id` | OrderController.update | OrderEdit.rules | redirect | redirect:'back' ; redirect:'/order' ; redirect:'back' | withErrors,flash,notification,Warning | YES |
| DELETE | `/order` | OrderController.multidelete | - | redirect | redirect:'/order' ; redirect:'/order' ; redirect:'/order' | flash,notification,warning | - |
| POST | `/notification` | NotificationController.store | NotificationCreateValidator.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| PUT|PATCH | `/notification/:id` | NotificationController.update | NotificationEdit.rules | send | - | flash,notification | - |
| POST | `/notification/cancel` | NotificationController.cancel | - | redirect | redirect:'/notification' ; redirect:'/notification' | flash,notification,warning | - |
| POST | `/notification/final` | NotificationController.final | - | redirect | redirect:'/notification' ; redirect:'/notification' | flash,notification,warning | - |
| POST | `/notification/delete` | NotificationController.delete | - | redirect | redirect:'/notification' ; redirect:'/notification' | flash,notification,warning | - |
| POST | `/notification/save` | NotificationController.save | NotificationCreateValidator.rules | send | - | flash,notification | - |
| DELETE | `/notification` | NotificationController.multidelete | - | redirect | redirect:'/notification' ; redirect:'/notification' ; redirect:'/notification' | flash,notification,warning | - |
| POST | `/order-review/delete` | OrderReviewController.delete | - | redirect | redirect:'/order-review' | flash,notification | - |
| POST | `/order-review/multidelete` | OrderReviewController.multidelete | - | redirect | redirect:'/order-review' ; redirect:'/order-review' | flash,warning,notification | - |
| POST | `/global-configuration/updatebyproductgposb2b` | GlobalConfigurationController.updateByProductGposb2b | - | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | flash,notification,Warning,warning | YES |
| POST | `/global-configuration/delete` | GlobalConfigurationController.delete | - | redirect | redirect:'/global-configuration' | flash,notification,warning | - |
| POST | `/global-configuration/multidelete` | GlobalConfigurationController.multidelete | - | redirect | redirect:'/global-configuration' ; redirect:'/global-configuration' | flash,notification,warning | - |
| POST | `/global-configuration` | GlobalConfigurationController.store | GlobalConfigurationCreateEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/global-configuration' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| PUT|PATCH | `/global-configuration/:id` | GlobalConfigurationController.update | GlobalConfigurationCreateEdit.rules | redirect | redirect:'back' ; redirect:'/global-configuration' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,Warning,warning | YES |
| POST | `/banner/delete` | BannerController.delete | - | redirect | redirect:'/banner' | flash,notification,warning | - |
| POST | `/banner/multidelete` | BannerController.multidelete | - | redirect | redirect:'/banner' ; redirect:'/banner' | flash,notification,warning | - |
| POST | `/banner` | BannerController.store | BannerCreate.rules | status | - | - | - |
| PUT|PATCH | `/banner/:id` | BannerController.update | BannerEdit.rules | status | - | - | - |
| DELETE | `/group-story` | GroupStoryController.multidelete | - | redirect | redirect:'/group-story' ; redirect:'/group-story' | flash,notification,warning | - |
| POST | `/group-story` | GroupStoryController.store | - | status,json | - | flash,notification | - |
| PUT|PATCH | `/group-story/:id` | GroupStoryController.update | - | status | - | flash,notification | - |
| DELETE | `/group-story/:id` | GroupStoryController.destroy | - | redirect | redirect:'/group-story' | flash,notification,warning | - |
| POST | `/referral-code` | ReferralCodeController.store | ReferralCodeValidator.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/referral-code' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| DELETE | `/referral-code/:id` | ReferralCodeController.delete | - | redirect | redirect:'/referral-code' | flash,notification,warning | - |
| DELETE | `/referral-code` | ReferralCodeController.deleteBulk | - | redirect | redirect:'/referral-code' ; redirect:'/referral-code' | flash,warning,notification | - |
| PUT|PATCH | `/referral-code/:id` | ReferralCodeController.update | ReferralCodeValidator.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/referral-code' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| POST | `/custom-catalog/delete` | CustomCatalogController.delete | - | redirect | redirect:'/custom-catalog' | flash,notification,warning | - |
| POST | `/custom-catalog/multidelete` | CustomCatalogController.multidelete | - | redirect | redirect:'/custom-catalog' ; redirect:'/custom-catalog' | flash,notification,warning | - |
| POST | `/custom-catalog` | CustomCatalogController.store | CustomCatalogCreate.rules | redirect | redirect:'back' ; redirect:'/custom-catalog/' + result.data['id'] + '/edit' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,warning | YES |
| PUT|PATCH | `/custom-catalog/:id` | CustomCatalogController.update | CustomCatalogEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' ; redirect:'back' | withErrors,flash,Warning,notification,warning | YES |
| POST | `/custom-catalog-product-homepage/delete` | CustomCatalogProductHomepageController.delete | - | redirect | redirect:'back' | flash,notification,warning | YES |
| POST | `/custom-catalog-product-homepage/multidelete` | CustomCatalogProductHomepageController.multidelete | - | redirect | redirect:'/custom-catalog-product-homepage' ; redirect:'back' | flash,notification,warning | YES |
| POST | `/custom-catalog-product-homepage` | CustomCatalogProductHomepageController.store | CustomCatalogProductHomepageCreate.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,warning | YES |
| PUT|PATCH | `/custom-catalog-product-homepage/:id` | CustomCatalogProductHomepageController.update | CustomCatalogProductHomepageEdit.rules | redirect | redirect:'back' ; redirect:'/custom-catalog-product-homepage' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,Warning,warning | YES |
| PUT|PATCH | `/product-gposb2b/:id` | ProductGposb2bController.update | ProductGposb2bEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' ; redirect:'back' | withErrors,flash,Warning,notification,warning | YES |
| POST | `/product-gposb2b-homepage` | ProductGposb2bHomepageController.store | ProductGposb2bHomepageCreate.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,warning | YES |
| PUT|PATCH | `/product-gposb2b-homepage/:id` | ProductGposb2bHomepageController.update | ProductGposb2bHomepageEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | withErrors,flash,Warning,notification,warning | YES |
| POST | `/product-gposb2b-homepage/delete` | ProductGposb2bHomepageController.delete | - | redirect | redirect:'/product-gposb2b' | flash,notification,warning | - |
| POST | `/product-gposb2b-homepage/multidelete` | ProductGposb2bHomepageController.multidelete | - | redirect | redirect:'/product-gposb2b' ; redirect:'/product-gposb2b' | flash,notification,warning | - |
| POST | `/custom-criteria` | CustomCriteriaController.store | CustomCriteriaCreateEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/custom-criteria' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| POST | `/custom-criteria/update_by_custom_type/:type` | CustomCriteriaController.updateByCustomType | CustomCriteriaCreateEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,Warning,warning | YES |
| POST | `/custom-criteria/delete` | CustomCriteriaController.delete | - | redirect | redirect:'back' | flash,notification,warning | YES |
| POST | `/custom-criteria/multidelete` | CustomCriteriaController.multidelete | - | redirect | redirect:'/custom-criteria' ; redirect:'back' | flash,notification,warning | YES |
| POST | `/content` | ContentController.store | ContentCreateEdit.rules | redirect | redirect:'back' ; redirect:'/content' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,warning | YES |
| PUT|PATCH | `/content/:id` | ContentController.update | ContentCreateEdit.rules | redirect | redirect:'back' ; redirect:'/content' ; redirect:'back' | withErrors,flash,notification,Warning | YES |
| POST | `/content/delete` | ContentController.delete | - | redirect | redirect:'/content' | flash,notification,warning | - |
| POST | `/content/multidelete` | ContentController.multidelete | - | redirect | redirect:'/content' ; redirect:'/content' | flash,warning,notification | - |
| DELETE | `/faqs` | FAQController.multidelete | - | redirect | redirect:'/faqs' ; redirect:'/faqs' | flash,notification,warning | - |
| POST | `/faqs` | FAQController.store | FAQCreateEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/faqs' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| PUT|PATCH | `/faqs/:id` | FAQController.update | FAQCreateEdit.rules | redirect | redirect:'back' ; redirect:'/faqs' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| DELETE | `/faqs/:id` | FAQController.destroy | - | redirect | redirect:'/faqs' | flash,notification | - |
| PUT|PATCH | `/products/:id` | ProductController.update | ProductEdit.rules | redirect,send | redirect:'back' ; redirect:'/products' ; redirect:'back' | flash,withErrors,warning,notification | YES |
| DELETE | `/product-category` | ProductCategoryController.multidelete | - | redirect | redirect:'/product-category' ; redirect:'/product-category' | flash,notification,warning | - |
| POST | `/product-category` | ProductCategoryController.store | ProductCategoryCreateEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/product-category' | flash,withErrors,warning,notification | YES |
| PUT|PATCH | `/product-category/:id` | ProductCategoryController.update | ProductCategoryCreateEdit.rules | redirect | redirect:'back' ; redirect:'/product-category' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| DELETE | `/product-category/:id` | ProductCategoryController.destroy | - | redirect | redirect:'/product-category' | flash,notification | - |
| POST | `/poin-voucher/setting-point/create-point/bonus-point-program/summary` | PoinVoucherController.createBonusPointProgramSummary | PoinSettingCreate.rules, programIdValidationMap | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | flash,warning,error | YES |
| POST | `/poin-voucher/setting-point/create-point/bonus-point-program/summary/store` | PoinVoucherController.storeBonusPointProgramSummary | - | redirect | redirect:'/poin-voucher/setting-point/' ; redirect:'/poin-voucher/setting-point/create-point/bonus-point-program' ; redirect:'/poin-voucher/setting-point/create | flash,notification,warning | - |
| POST | `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary` | PoinVoucherController.editBonusPointProgramSummary | programIdValidationMap, programTypeValidationMap | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | flash,warning,error | YES |
| POST | `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary/store` | PoinVoucherController.updateBonusPointProgramSummary | - | redirect | redirect:'/poin-voucher/setting-point' ; redirect:'/poin-voucher/setting-point/edit-point/bonus-point-program/'+params.id ; redirect:'/poin-voucher/setting-poin | flash,notification,warning | - |
| POST | `/poin-voucher/setting-point/update-status` | PoinVoucherController.updateStatus | - | redirect | redirect:'back' ; redirect:'back' | flash,notification,warning | YES |
| POST | `/poin-voucher/inject-point/create/summary` | PoinVoucherController.createInjectPointSummary | InjectPointCreate.rules | redirect | redirect:'back' | flash,withErrors,warning | YES |
| POST | `/poin-voucher/inject-point/create/summary/store` | PoinVoucherController.storeInjectPointSummary | InjectPointCreate.rules | redirect | redirect:'/poin-voucher/inject-point/create' ; redirect:'/poin-voucher/inject-point' ; redirect:'/poin-voucher/inject-point/create' ; redirect:'/poin-voucher/in | withErrors,flash,notification,warning | - |
| POST | `/poin-voucher/inject-point` | PoinVoucherController.multideleteInjectPoint | - | redirect | redirect:'/poin-voucher/inject-point' ; redirect:'/poin-voucher/inject-point' | flash,notification,warning | - |
| DELETE | `/poin-voucher/inject-point` | PoinVoucherController.deleteInjectPoint | - | redirect | redirect:'/poin-voucher/inject-point' | flash,notification,warning | - |
| POST | `/poin-voucher` | PoinVoucherController.store | InjectPointCreate.rules | redirect | redirect:'back' ; redirect:'poin-voucher/inject-point' ; redirect:'back' ; redirect:'back' | withErrors,flash,notification,warning | YES |
| POST | `/voucher-setting/:code/create-voucher/summary` | PoinVoucherSettingVoucherController.createVoucherSummary | PoinVoucherCreate.rules | redirect | redirect:'back' | withErrors | YES |
| POST | `/voucher-setting/:code/create-voucher/summary/store` | PoinVoucherSettingVoucherController.storeVoucher | - | redirect | redirect:'/voucher-setting/'+code ; redirect:'/voucher-setting/' + code + '/create-voucher' | flash,notification,warning | - |
| POST | `/voucher-setting/:code/update-voucher/:id/summary` | PoinVoucherSettingVoucherController.editVoucherSummary | PoinVoucherCreate.rules | redirect | redirect:'back' | withErrors | YES |
| POST | `/voucher-setting/:code/update-voucher/:id/summary/update` | PoinVoucherSettingVoucherController.updateVoucher | - | redirect | redirect:'/voucher-setting/' + code ; redirect:'/voucher-setting/' + code + '/update-voucher/' + id | flash,notification,warning | - |
| PUT | `/voucher-setting/:code/update-is-active/:id` | PoinVoucherSettingVoucherController.updateVoucherIsActive | - |  | - | - | - |
| DELETE | `/customer-groups` | CustomerGroupController.multidelete | - | redirect | redirect:'/customer-groups' ; redirect:'/customer-groups' | flash,notification,warning | - |
| POST | `/customer-groups` | CustomerGroupController.store | - | status,json | - | flash,notification | - |
| PUT|PATCH | `/customer-groups/:id` | CustomerGroupController.update | - | status,json | - | flash,notification | - |
| DELETE | `/customer-groups/:id` | CustomerGroupController.destroy | - | redirect | redirect:'/customer-groups' | flash,notification,warning | - |
| DELETE | `/inventories` | InventoryController.multidelete | - | redirect | redirect:'/inventories' ; redirect:'/inventories' | flash,notification,warning | - |
| POST | `/inventories` | InventoryController.store | InventoryCreate.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/inventories' | flash,withErrors,warning,notification | YES |
| PUT|PATCH | `/inventories/:id` | InventoryController.update | InventoryUpdate.rules | redirect | redirect:'back' ; redirect:'/inventories' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| DELETE | `/inventories/:id` | InventoryController.destroy | - | redirect | redirect:'/inventories' | flash,notification | - |
| DELETE | `/inventories/:inventoryId/inventory-stocks` | InventoryStockController.multidelete | - | redirect | redirect:'back' ; redirect:'back' | flash,notification,warning | YES |
| POST | `/inventories/:inventoryId/inventory-stocks` | InventoryStockController.store | InventoryStockCreate.rules | redirect | redirect:'back' ; redirect:'back' | flash,withErrors,warning,notification | YES |
| PUT|PATCH | `/inventories/:inventoryId/inventory-stocks/:id` | InventoryStockController.update | InventoryStockUpdate.rules | redirect | redirect:'back' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| DELETE | `/inventories/:inventoryId/inventory-stocks/:id` | InventoryStockController.destroy | - | send | - | flash,notification | - |
| DELETE | `/sponsored-products` | SponsoredProductController.multidelete | - | redirect | redirect:'/sponsored-products' ; redirect:'/sponsored-products' | flash,notification,warning | - |
| POST | `/sponsored-products` | SponsoredProductController.store | SponsoredProductCreateEdit.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'/sponsored-products' | flash,withErrors,warning,notification | YES |
| PUT|PATCH | `/sponsored-products/:id` | SponsoredProductController.update | SponsoredProductCreateEdit.rules | redirect | redirect:'back' ; redirect:'/sponsored-products' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| DELETE | `/sponsored-products/:id` | SponsoredProductController.destroy | - | redirect | redirect:'/sponsored-products' | flash,notification | - |
| POST | `/product-restrictions/delete` | ProductRestrictedController.delete | - | redirect | redirect:"/product-restrictions" | flash,notification,warning | - |
| POST | `/product-restrictions/multidelete` | ProductRestrictedController.multidelete | - | redirect | redirect:"/product-restrictions" ; redirect:"/product-restrictions" | flash,notification,warning | - |
| POST | `/product-restrictions` | ProductRestrictedController.store | - | redirect | redirect:"back" ; redirect:"back" ; redirect:"back" | flash,warning,notification | YES |
| PUT|PATCH | `/product-restrictions/:id` | ProductRestrictedController.update | - | redirect | redirect:"back" ; redirect:"/product-restrictions" ; redirect:"back" ; redirect:"back" | flash,warning,notification | YES |
| DELETE | `/product-restrictions/:id` | ProductRestrictedController.destroy | - | redirect | redirect:"/product-restrictions" | flash,notification,warning | - |
| POST | `/files/signurl` | FileController.signURL | FileSignURL.rules | status,send | - | - | - |
| POST | `/user-management/delete` | UserManagementController.delete | - | redirect | redirect:'/user-management' | flash,notification,warning | - |
| POST | `/user-management/:id/update-is-active` | UserManagementController.updateIsActive | - | status | - | - | - |
| POST | `/payment/:id` | PaymentController.postTriggerReceipt | - | redirect | redirect:'/payment/'+params.id ; redirect:'/payment/'+params.id | flash,error,notification | - |
| POST | `/register-folamil` | RegisterFolamilController.store | - | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' ; redirect:'back' | flash,warning,error_validation,success,success_temporary,warning_temporary | YES |
| POST | `/gamification` | GamificationController.store | GamificationCreateDraft.getRules | status | - | - | - |
| PUT | `/gamification/:id` | GamificationController.update | GamificationEditProgram.getRules, timelineRules, GamificationEditReward.rules | status | - | - | - |
| POST | `/gamification/:id/post-update` | GamificationController.postUpdate | - | redirect | redirect:'/gamification/' + params.id | flash,success_toast | - |
| POST | `/gamification/delete` | GamificationController.delete | - | status | - | - | - |
| PUT | `/gamification/:id/update-status` | GamificationController.updateStatus | - | status | - | - | - |
| GET | `/gamification/:id/generate-csv` | GamificationController.downloadGenerateCsv | - | send,status | - | - | - |
| POST | `/gamification/upload-csv` | GamificationController.uploadCsv | - | status,send | - | - | - |
| GET | `/gamification/:id/generate-csv-progress` | GamificationController.downloadGenerateCsvProgress | - | send,status | - | - | - |
| POST | `/gamification/upload-csv-progress` | GamificationController.uploadCsvProgress | - | status,send | - | - | - |
| GET | `/gamification/upload-csv-history/:id` | GamificationController.getUploadCsvHistory | - | send | - | - | - |
| POST | `/gpos-brand/shipping-voucher/submit` | GposBrandShippingVoucherController.submitVoucher | GposBrandShipppingVoucherCreate.rules | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' ; redirect:'/gpos-brand/shipping-voucher' | withErrors,flash,warning,success | YES |
| GET | `/gpos-brand/shipping-voucher/:id/cancel` | GposBrandShippingVoucherController.cancelVoucher | - | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | flash,success,warning | YES |
| POST | `/gpos-brand/:id/update-shipment-fee` | GposBrandController.updateShipmentFee | - | redirect | redirect:'/gpos-brand/detail-pesanan/' + params.id ; redirect:'back' ; redirect:'back' | flash,success,warning | YES |
| POST | `/gpos-brand/:id/update-shipment-detail` | GposBrandController.updateShipmentDetail | - | redirect | redirect:'/gpos-brand/detail-pesanan/' + params.id ; redirect:'back' ; redirect:'back' | flash,success,warning | YES |
| POST | `/gpos-brand/:id/update-status-to-canceled` | GposBrandController.updateStatusToCanceled | - | redirect | redirect:'/gpos-brand/detail-pesanan/' + params.id ; redirect:'back' ; redirect:'back' | flash,success,warning | YES |
| POST | `/loyalty-member/:id/voucher` | LoyaltyMemberController.storeProgramDetailByPrincipal | - | redirect | redirect:'/loyalty-member/' + id ; redirect:'back' ; redirect:'back' | flash,notification,warning | YES |
| POST | `/loyalty-member/:id/point` | LoyaltyMemberController.storeProgramDetailByPrincipal | - | redirect | redirect:'/loyalty-member/' + id ; redirect:'back' ; redirect:'back' | flash,notification,warning | YES |
| POST | `/loyalty-member/:id/update` | LoyaltyMemberController.putProgramDetailByPrincipal | LoyaltyMemberValidation.rules | redirect | redirect:'back' ; redirect:'/loyalty-member/' + body.loyalty_card_id ; redirect:'back' ; redirect:'back' | withErrors,flash,warning,notification | YES |
| POST | `/loyalty-member/card` | LoyaltyMemberController.storeCard | - | redirect,status | redirect:'back' | - | YES |
| POST | `/loyalty-member/generate-csv` | LoyaltyMemberController.generateCardCsv | - | status | - | - | - |
| POST | `/loyalty-member/validate-branch-csv` | LoyaltyMemberController.validateBranchCsv | - | status | - | - | - |
| POST | `/loyalty-member/card/:id` | LoyaltyMemberController.putCard | - | redirect | redirect:'back' | flash,success,error | YES |
| POST | `/user-verification/:id/reject` | UserVerificationController.reject | - | json,status | - | - | - |
| POST | `/user-verification/:id/approve` | UserVerificationController.approve | - | json,status | - | - | - |
| POST | `/user-verification/:id/update` | UserVerificationController.update | - | json,status | - | - | - |
| POST | `/personalization/channels/customers-validate` | PersonalizationChannelController.CustomersValidateController | - | redirect,status | redirect:'back' ; redirect:'back' | flash,success,warning | YES |
| GET | `/personalization/channels/products/:id` | PersonalizationChannelController.getProductDetail | - | redirect | redirect:'back' | flash,warning | YES |
| DELETE | `/personalization/channels/products/bulk` | PersonalizationChannelController.deleteProductBulk | - | redirect | redirect:'back' ; redirect:'back' ; redirect:'back' | flash,warning,success | YES |
| DELETE | `/personalization/channels/products/:id` | PersonalizationChannelController.deleteProduct | - | redirect | redirect:'back' ; redirect:'back' | flash,warning | YES |
| POST | `/personalization/channels/:id/products/save` | PersonalizationChannelController.saveProduct | - | redirect | redirect:'back' ; redirect:'back' | flash,warning,success | YES |
| POST | `/personalization/channels/create` | PersonalizationChannelController.createPersonalizationChannel | - | redirect | redirect:`/personalization/channels/${result.data.id}` ; redirect:'back' ; redirect:'back' | flash,warning | YES |
| POST | `/personalization/channels/:id` | PersonalizationChannelController.update | ChannelUpdate.rules | status | - | - | - |
| DELETE | `/personalization/channels/:id` | PersonalizationChannelController.deleteChannelController | - | redirect | redirect:'back' ; redirect:'back' | flash,warning,success | YES |

## 19. Search / Filter / Sort / Pagination (A1.18)

| Screen | Search | Filters (UI → request parameter) | Default sort | Page size | Backend consumer |
|---|---|---|---|---|---|
| S002 Principal | Global → `keyword` | — | `is_active` DESC | 5 | PrincipalController.datatable |
| S005 Feedback | Global | — | Last column DESC | 5 | FeedbackController.datatable |
| S007 Order | Structured JSON in `search.value` | custId → `customer_ids`; filter (purchase_no / invoice_no / customer_name / id) → `filter` | created_at DESC | 5 | OrderMapper |
| S009 Notification | Global (`search_by` = title) | Status chips → `filters[status]` | created_at DESC (fixed) | 5 | NotificationMapper |
| S012 Order Review | Global | — | created_at DESC | 5 | OrderReviewMapper |
| S014 Global configuration | Global | — | created_at DESC | 5 | Mapper |
| S017 Banner | Global | `#filter-status` → `status`; `#filter-type` → `type` | Sequence ASC; only columns 3 and 9-11 are sortable | 15 | BannerMapper |
| S020 Group Story | Global | — | Sequence DESC, not changeable; expired rows are moved last on the server | 5 | GroupStoryController |
| S023 Referral | Global | — | `[[2,'asc']]`; only Kuota and Periode are sortable | 5 (sent as GET) | ReferralCodeMapper |
| S026 Custom catalog | Global | — | `sort_by` = `columns[order.column-2]` (off by two); direction fixed ASC | 15 | CustomCatalogMapper |
| S029, S036 | Global | — | created DESC | 5 | Mappers |
| S039 Content | Global | — | created_at DESC | 5 | ContentController |
| S042 FAQ | Global | — | detail DESC | 5 | FAQController |
| S045 Product | Global | `#filter_is_active`, `#filter_is_draft` → `filters[]` | Draft ASC | 5 | ProductController |
| S047 Category | Global | — | Sequence DESC | 5 | Controller |
| S063 Inject point | Global (`search_by` = aam_customer_id) | — | Last column DESC | 15 | InjectPoinMapper |
| S064 Mutasi | Global (the box is still visible) | delivery_no, purchase_no, branch_id (overrides customer_ids), customer_ids, start/end_date_transaction (sent only when both are set), point_type_ids. `no_invoice` and `mutation_type` are **dropped** | DESC | 15 | MutasiRedeemPoinMapper |
| S072 Customer group | Global | — | created_at DESC | 5 | Controller |
| S075 Inventory | Global | — | hna_price DESC | 5 | Controller |
| S078 Sponsored product | Global | — | Sequence DESC | 5 | Controller |
| S081 Restriction | Global | — | Server default created_at desc, take 10 | 5 | Controller |
| S084 User management | Type (customer.name / user.email) + keyword, as JSON | branch_id → `filters[customer_area_id IN]` | Always `aam_customer_id` | 15 | UserManagementMapper |
| S085 Payment | Off | start/end date, aam_customer_ids | trx_amount DESC | 15 | PaymentMapper |
| S094 Shipping voucher | Global | — | Fixed: `status` | 5 | Mapper |
| S097 GPOS Brand | Global | All 6 `sales_order_status` values, fixed | Fixed: `status` | 5 | GposBrandMapper |
| S103 Verifikasi Akun | Type (customer_id / email) + keyword, as JSON | Status buttons → `filters[status EQ]` | None | 5 (All is sent as 10000) | UserVerificationMapper |
| S104 Channel | Global | Status chips → `status` | created_by DESC; `stateSave` on | 5 | Controller |
| S105 Channel products tab | Off | — | Off | 5 | PersonalizationChannelMapper |
| S107 Homepage products tab | Global | — | created DESC | 5 | PGH Mapper |
| S060 Setting Point | keyword | — | created_at desc | 5/10/25/50/All | PVC.list |
| S088 Gamification | keyword | `is_multi_period` | created_at desc | 5/10/25/50/All | GamificationController.list |
| S098 Loyalty programs | search (ignored by the server) | — | — | 5 | LMC.programByPrincipalDataTable |

No list keeps its state in the URL. The only persisted state is the DataTables `stateSave` on S104 [SOURCE].

## 20. Export / Import / Download (A1.19)

| Screens | Trigger | Route | Method | File type | Generated where | Browser behavior |
|---|---|---|---|---|---|---|
| DataTables lists with the default buttons: S002, S005, S007, S012, S014, S017, S020, S026, S029, S036, S039, S042, S045, S047, S063, S064, S072, S075, S078, S081, S105 products tab, S107 tab | Copy / Excel / PDF / Print / ColVis | None | — | Clipboard / xlsx / pdf / print | **In the browser**, current page only [INFERRED] | Download |
| S084 User management | Same buttons, with custom print columns and landscape PDF | None | — | xlsx / pdf / print | Browser | Download |
| S103 Verifikasi Akun | "Unduh Data" | None | — | xlsx | Browser | Shows a fixed success toast |
| S085 Payment | ColVis only | — | — | — | — | — |
| S023, S094, S097, S104 | No buttons | — | — | — | — | — |
| S092/S093 Gamification | Download CSV (data / progress) | `GET /gamification/:id/generate-csv`, `…/generate-csv-progress` | GET | CSV (via a returned URL) | **Server** (gateway) | Hidden `<a download>` |
| S092/S093 | Upload CSV | `POST /gamification/upload-csv`, `…/upload-csv-progress` | POST | CSV | Import | Toast |
| S092/S093 | CSV history | `GET /gamification/upload-csv-history/:id` | GET | Links | Server | Modal list |
| S099/S100, S102 | Template CSV | `POST /loyalty-member/generate-csv` | POST | CSV | **External / static file** (URL from env) | `<a download>` |
| S102 | Validate branch CSV | `POST /loyalty-member/validate-branch-csv` | POST | CSV | Parsed on the server | Count text |
| S087 Folamil | Template download | Hardcoded OSS URL | GET | CSV | **External file** | Opens |
| S087 Folamil | Upload | `POST /register-folamil` | POST | CSV (URL) | Imported through the gateway | Flash HTML |

There are no server-side Excel or PDF generation routes.

## 21. Preliminary Next.js Route Candidates (A1.21)

Every entry here is **[PROPOSED]**. The candidates follow the B0 convention: `/dashboard/<feature>[/create | /update/[id] | /detail/[id]]` plus an `(auth)` group. They do not imply URL parity with the legacy app, and HOW each one is built is decided later under B0 rules.

| Legacy routes | Legacy screen | Capability | Target candidate [PROPOSED] |
|---|---|---|---|
| `/`, `POST /login`, `/logout` | Login / logout | auth | `/login`; logout action |
| `/home` | Beranda | Static home | `/dashboard/home` |
| `/order*` | Order/Pesanan | List, filter, sync, delete, detail | `/dashboard/order`, `…/detail/[id]` |
| `/order-review*` | Order Review | List, detail | `/dashboard/order-review`, `…/detail/[id]` |
| `/payment*` | Pembayaran | List, filter, detail, trigger | `/dashboard/payment`, `…/detail/[id]` |
| `/inventories*` | Inventory | CRUD + stock | `/dashboard/inventory` (+ create / update/[id]) |
| `/products*` | Produk | List, filter, edit | `/dashboard/product`, `…/update/[id]` |
| `/product-category*` | Kategori Produk | CRUD | `/dashboard/product-category` (+ create / update) |
| `/product-gposb2b*`, `/product-gposb2b-homepage*` | Produk Gpos B2b | Config, homepage products, criteria | `/dashboard/product-gposb2b` |
| `/custom-catalog*`, `/custom-catalog-product-homepage*`, `/custom-criteria*` | Personalisasi Katalog | CRUD, products, criteria | `/dashboard/custom-catalog` (+ create / update/[id]) |
| `/product-restrictions*` | Pembatasan produk | CRUD | `/dashboard/product-restriction` (+ create / update) |
| `/loyalty-member*` | Loyalty Member | Cards, programs, CSV | `/dashboard/loyalty-member`, `…/[id]`, `…/[id]/create`, `…/[id]/detail/[programId]` |
| `/poin-voucher/setting-point*` | Pengaturan Poin | List, wizard, toggle | `/dashboard/poin-voucher/setting-point` (+ create / update) |
| `/poin-voucher/inject-point*` | Inject Poin | List, cancel, wizard | `/dashboard/poin-voucher/inject-point` (+ create) |
| `/poin-voucher/redeem*` | Mutasi & Redeem | Filtered list | `/dashboard/poin-voucher/redeem` |
| `/voucher-setting*` | Voucher Setting | Categories, vouchers, toggle | `/dashboard/poin-voucher/voucher-setting/[code]` (+ create / update) |
| `/notification*` | Push Notification | CRUD, schedule, cancel/final | `/dashboard/notification` (+ create / update) |
| `/banner*` | Banner & Iklan | List, inline edit, CRUD, criteria | `/dashboard/banner` (+ create / update) |
| `/group-story*` | Group Story | CRUD, banner picker | `/dashboard/group-story` (+ create / update) |
| `/sponsored-products*` | Produk Sponsor | CRUD | `/dashboard/sponsored-product` (+ create / update) |
| `/gamification*` | Gamification | List, create, detail, duplicate, CSV | `/dashboard/gamification`, `…/create`, `…/detail/[id]` |
| `/gpos-brand/shipping-voucher*` | Voucher Pengiriman | List, create, cancel | `/dashboard/shipping-voucher` (+ create) |
| `/gpos-brand`, `/gpos-brand/detail-pesanan/:id` | GPOS Brand | Order list, processing | `/dashboard/gpos-brand`, `…/detail/[id]` |
| `/referral-code*` | Kode Telesales | CRUD, bulk delete | `/dashboard/referral-code` (+ create / update) |
| `/customer-groups*` | Grup Pelanggan | CRUD | `/dashboard/customer-group` (+ create / update) |
| `/personalization/channels*` | Konfigurasi Channel | List, wizard | `/dashboard/channel-configuration`, `…/update/[id]` |
| `/user-verification*` | Verifikasi Akun | List, review | `/dashboard/user-verification` |
| `/principal*` | Prinsipal | CRUD, image | `/dashboard/principal` (+ create / update) |
| `/register-folamil` | Pendaftaran Folamil | CSV upload | `/dashboard/register-folamil` |
| `/global-configuration*` | Konfigurasi Umum | CRUD | `/dashboard/global-configuration` (+ create / update) |
| `/user-management*` | Manajemen Pengguna | List, toggle | `/dashboard/user-management`. The target already has `/dashboard/user`; resolve the overlap in A2/A4 |
| `/feedback*` | Masukan | List, edit | `/dashboard/feedback`, `…/update/[id]` |
| `/content*` | Konten | CRUD | `/dashboard/content` (+ create / update) |
| `/faqs*` | FAQ | CRUD | `/dashboard/faq` (+ create / update) |
| Mockups S050-S052, S057, S058; missing S033-S035 | — | — | **No candidate** until A3 |

## 22. Screen Completeness Matrix (A1.22)

Column meanings:
- **JS**: inline script in the view closure.
- **Mapper**: server-built HTML cells for the table.
- **Form**: a POST or AJAX submit.
- **API**: a same-origin AJAX or datatable endpoint.
- **Validation**: the controller uses a validator.

| Screen ID | Route | View | Controller | JS | Mapper/HTML cells | Form | API/Endpoint (same-origin) | Menu | Validation | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S001 | GET `/home` | dashboard | HomeController.home | YES | N/A | NO | YES | YES (Payment(hidden),Marketing(hidden),Superadmin) | N/A | ACTIVE-CANDIDATE (static widgets; hidden in Payment/Marketing menus) | views.json / ctrl.json |
| S002 | GET `/principal` | principals/list | PrincipalController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S003 | GET `/principal/create` | principals/create | PrincipalController.create | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S004 | GET `/principal/:id/edit` | principals/edit | PrincipalController.edit | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S005 | GET `/feedback` | feedbacks/list | FeedbackController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S006 | GET `/feedback/:id/edit` | feedbacks/edit | FeedbackController.edit | NO | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S007 | GET `/order` | orders/list | OrderController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S008 | GET `/order/:id/edit` | orders/edit | OrderController.edit | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S009 | GET `/notification` | notifications/list | NotificationController.index | YES | YES | YES | YES | YES (Marketing,Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S010 | GET `/notification/create` | notifications/create | NotificationController.create | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S011 | GET `/notification/:id/edit` | notifications/edit | NotificationController.edit | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S012 | GET `/order-review` | order_reviews/list | OrderReviewController.index | YES | YES | YES | YES | YES (Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S013 | GET `/order-review/:id/edit` | order_reviews/edit | OrderReviewController.edit | NO | N/A | NO | NO | NO | N/A | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S014 | GET `/global-configuration` | global_configurations/list | GlobalConfigurationController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S015 | GET `/global-configuration/create` | global_configurations/create | GlobalConfigurationController.create | NO | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S016 | GET `/global-configuration/:id/edit` | global_configurations/edit | GlobalConfigurationController.edit | NO | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S017 | GET `/banner` | banners/list | BannerController.index | YES | YES | YES | YES | YES (Marketing,Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S018 | GET `/banner/create` | banners/create | BannerController.create | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S019 | GET `/banner/:id/edit` | banners/edit | BannerController.edit | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S020 | GET `/group-story` | group_story/list | GroupStoryController.index | YES | YES | YES | YES | YES (Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S021 | GET `/group-story/create` | group_story/create | GroupStoryController.create | YES | N/A | YES | YES | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S022 | GET `/group-story/:id/edit` | group_story/edit | GroupStoryController.edit | YES | N/A | YES | YES | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S023 | GET `/referral-code` | referral_code/list | ReferralCodeController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S024 | GET `/referral-code/create` | referral_code/create | ReferralCodeController.create | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S025 | GET `/referral-code/:id/edit` | referral_code/edit | ReferralCodeController.edit | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S026 | GET `/custom-catalog` | custom_catalogs/list | CustomCatalogController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S027 | GET `/custom-catalog/create` | custom_catalogs/create | CustomCatalogController.create | NO | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S028 | GET `/custom-catalog/:id/edit` | custom_catalogs/edit | CustomCatalogController.edit | YES | UNKNOWN | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S029 | GET `/custom-catalog-product-homepage` | custom_catalog_product_homepages/list | CustomCatalogProductHomepageController.index | YES | YES | YES | YES | NO | YES | UNKNOWN (no nav; reached only via wrong link) | views.json / ctrl.json |
| S030 | GET `/custom-catalog-product-homepage/create` | custom_catalog_product_homepages/create | CustomCatalogProductHomepageController.create | NO | N/A | YES | NO | NO | YES | UNKNOWN (no nav) | views.json / ctrl.json |
| S031 | GET `/custom-catalog-product-homepage/:id/edit` | custom_catalog_product_homepages/edit | CustomCatalogProductHomepageController.edit | NO | N/A | YES | NO | NO | YES | UNKNOWN (no nav) | views.json / ctrl.json |
| S032 | GET `/product-gposb2b/:id/edit` | product_gposb2bs/edit | ProductGposb2bController.edit | YES | YES | YES | YES | NO | YES | ACTIVE-CANDIDATE (alias of S107) | views.json / ctrl.json |
| S033 | GET `/product-gposb2b-homepage` | **MISSING** product_gposb2b_homepages/list | ProductGposb2bHomepageController.index | N/A | N/A | N/A | N/A | NO | YES | MISSING-VIEW | views.json / ctrl.json |
| S034 | GET `/product-gposb2b-homepage/create` | **MISSING** product_gposb2b_homepages/create | ProductGposb2bHomepageController.create | N/A | N/A | N/A | N/A | NO | YES | MISSING-VIEW | views.json / ctrl.json |
| S035 | GET `/product-gposb2b-homepage/:id/edit` | **MISSING** product_gposb2b_homepages/edit | ProductGposb2bHomepageController.edit | N/A | N/A | N/A | N/A | NO | YES | MISSING-VIEW | views.json / ctrl.json |
| S036 | GET `/custom-criteria` | custom_catalog_criterias/list | CustomCriteriaController.index | YES | YES | YES | YES | NO | YES | UNKNOWN (no nav; edit targets undefined action) | views.json / ctrl.json |
| S037 | GET `/custom-criteria/create` | custom_catalog_criterias/create | CustomCriteriaController.create | NO | N/A | YES | NO | NO | YES | UNKNOWN (no nav; validator can never pass) | views.json / ctrl.json |
| S038 | GET `/custom-criteria/:id/edit` | custom_catalog_criterias/edit | CustomCriteriaController.edit | NO | N/A | YES | NO | NO | YES | UNKNOWN (no nav; update action undefined) | views.json / ctrl.json |
| S039 | GET `/content` | contents/list | ContentController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S040 | GET `/content/create` | contents/create | ContentController.create | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S041 | GET `/content/:id/edit` | contents/edit | ContentController.edit | NO | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S042 | GET `/faqs` | faqs/list | FAQController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S043 | GET `/faqs/create` | faqs/create | FAQController.create | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S044 | GET `/faqs/:id/edit` | faqs/edit | FAQController.edit | NO | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S045 | GET `/products` | products/list | ProductController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S046 | GET `/products/:id/edit` | products/edit | ProductController.edit | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S047 | GET `/product-category` | product_category/list | ProductCategoryController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S048 | GET `/product-category/create` | product_category/create | ProductCategoryController.create | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S049 | GET `/product-category/:id/edit` | product_category/edit | ProductCategoryController.edit | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S050 | GET `/poin-voucher/setting-point/create-point/reguler` | poin_voucher/setting_point/create_point_reguler | PoinVoucherController.createPointReguler | NO | N/A | NO | NO | NO | YES | UNKNOWN (static mockup, unlinked) | views.json / ctrl.json |
| S051 | GET `/poin-voucher/setting-point/create-point/payment/summary` | poin_voucher/setting_point/create_point_payment_summary | PoinVoucherController.createPointPaymentSummmary | YES | N/A | YES | NO | NO | YES | UNKNOWN (static mockup, unlinked) | views.json / ctrl.json |
| S052 | GET `/poin-voucher/setting-point/create-point/payment` | poin_voucher/setting_point/create_point_payment | PoinVoucherController.createPointPayment | NO | N/A | NO | NO | NO | YES | UNKNOWN (static mockup, unlinked) | views.json / ctrl.json |
| S053 | GET `/poin-voucher/setting-point/create-point/bonus-point-program` | poin_voucher/setting_point/create_bonus_point_program | PoinVoucherController.createBonusPointProgram | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S054 | POST `/poin-voucher/setting-point/create-point/bonus-point-program/summary` | poin_voucher/setting_point/create_bonus_point_program_summary | PoinVoucherController.createBonusPointProgramSummary | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S055 | GET `/poin-voucher/setting-point/edit-point/bonus-point-program/:id` | poin_voucher/setting_point/edit_bonus_point_program | PoinVoucherController.editBonusPointProgram | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S056 | POST `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary` | poin_voucher/setting_point/edit_bonus_point_program_summary | PoinVoucherController.editBonusPointProgramSummary | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S057 | GET `/poin-voucher/setting-point/create-point/folamil/summary` | poin_voucher/setting_point/create_point_folamil_summary | PoinVoucherController.createPointFolamilSummary | YES | N/A | YES | NO | NO | YES | UNKNOWN (static mockup, unlinked) | views.json / ctrl.json |
| S058 | GET `/poin-voucher/setting-point/create-point/folamil` | poin_voucher/setting_point/create_point_folamil | PoinVoucherController.createPointFolamil | NO | N/A | NO | NO | NO | YES | UNKNOWN (static mockup, unlinked) | views.json / ctrl.json |
| S059 | GET `/poin-voucher/setting-point/create-point` | poin_voucher/setting_point/create_point | PoinVoucherController.createPoint | NO | N/A | NO | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S060 | GET `/poin-voucher/setting-point` | poin_voucher/setting_point/index | PoinVoucherController.settingPoint | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S061 | POST `/poin-voucher/inject-point/create/summary` | poin_voucher/inject_point/create_summary | PoinVoucherController.createInjectPointSummary | NO | N/A | YES | NO | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S062 | GET `/poin-voucher/inject-point/create` | poin_voucher/inject_point/create | PoinVoucherController.createInjectPoint | NO | N/A | YES | NO | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S063 | GET `/poin-voucher/inject-point` | poin_voucher/inject_point/list | PoinVoucherController.injectPoint | YES | UNKNOWN | YES | YES | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S064 | GET `/poin-voucher/redeem` | poin_voucher/mutasi_redeem/filter | MutasiRedeemPoinController.redeemPoint | YES | YES | YES | YES | NO | NO (manual/none) | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S065 | GET `/poin-voucher` | poin_voucher/list | PoinVoucherController.index | NO | N/A | NO | NO | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S066 | GET `/voucher-setting/:code` | poin_voucher/voucher_setting/voucher_category_view | PoinVoucherSettingVoucherController.getByVoucherType | YES | N/A | NO | YES | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S067 | GET `/voucher-setting/:code/create-voucher` | poin_voucher/voucher_setting/voucher_category/create | PoinVoucherSettingVoucherController.createVoucher | YES | N/A | YES | YES | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S068 | POST `/voucher-setting/:code/create-voucher/summary` | poin_voucher/voucher_setting/voucher_category/create_summary | PoinVoucherSettingVoucherController.createVoucherSummary | YES | N/A | YES | NO | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S069 | GET `/voucher-setting/:code/update-voucher/:id` | poin_voucher/voucher_setting/voucher_category/edit | PoinVoucherSettingVoucherController.editVoucher | YES | N/A | YES | YES | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S070 | POST `/voucher-setting/:code/update-voucher/:id/summary` | poin_voucher/voucher_setting/voucher_category/edit_summary | PoinVoucherSettingVoucherController.editVoucherSummary | YES | N/A | YES | NO | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S071 | GET `/voucher-setting` | poin_voucher/voucher_setting/list | PoinVoucherSettingVoucherController.index | NO | N/A | NO | NO | NO | YES | UNKNOWN (hub card commented out; URL-only) | views.json / ctrl.json |
| S072 | GET `/customer-groups` | customer_group/list | CustomerGroupController.index | YES | YES | YES | YES | YES (Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S073 | GET `/customer-groups/create` | customer_group/create | CustomerGroupController.create | YES | N/A | YES | YES | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S074 | GET `/customer-groups/:id` | customer_group/create | CustomerGroupController.show | YES | N/A | YES | YES | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S075 | GET `/inventories` | inventories/list | InventoryController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S076 | GET `/inventories/create` | inventories/create | InventoryController.create | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S077 | GET `/inventories/:id/edit` | inventories/edit | InventoryController.edit | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S078 | GET `/sponsored-products` | sponsored_products/list | SponsoredProductController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S079 | GET `/sponsored-products/create` | sponsored_products/create | SponsoredProductController.create | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S080 | GET `/sponsored-products/:id/edit` | sponsored_products/edit | SponsoredProductController.edit | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S081 | GET `/product-restrictions` | product_restrictions/list | ProductRestrictedController.index | YES | YES | YES | YES | YES (Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S082 | GET `/product-restrictions/create` | product_restrictions/create | ProductRestrictedController.create | NO | N/A | YES | NO | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S083 | GET `/product-restrictions/:id/edit` | product_restrictions/edit | ProductRestrictedController.edit | YES | N/A | YES | NO | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S084 | GET `/user-management` | user_management/list | UserManagementController.index | YES | YES | YES | YES | YES (Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S085 | GET `/payment` | payment/list | PaymentController.index | YES | YES | YES | YES | YES (Payment,Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S086 | GET `/payment/:id` | payment/detail | PaymentController.detail | YES | N/A | YES | NO | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S087 | GET `/register-folamil` | register_folamil/index | RegisterFolamilController.index | YES | N/A | YES | YES | YES (Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S088 | GET `/gamification` | gamification/index | GamificationController.index | YES | N/A | NO | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S089 | GET `/gamification/create/type` | gamification/create_type | GamificationController.createType | NO | N/A | NO | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S090 | GET `/gamification/create/single` | gamification/create | GamificationController.createSingle | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S091 | GET `/gamification/create/multi` | gamification/create | GamificationController.createMulti | YES | N/A | YES | YES | NO | YES | UNKNOWN (type card commented out; URL-only) | views.json / ctrl.json |
| S092 | GET `/gamification/:id` | gamification/edit | GamificationController.edit | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S093 | GET `/gamification/:id/duplicate` | gamification/edit | GamificationController.duplicate | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S094 | GET `/gpos-brand/shipping-voucher` | gpos_brand/shipping_voucher/list | GposBrandShippingVoucherController.index | YES | UNKNOWN | NO | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S095 | GET `/gpos-brand/shipping-voucher/create` | gpos_brand/shipping_voucher/create | GposBrandShippingVoucherController.create | YES | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S096 | GET `/gpos-brand/detail-pesanan/:id` | gpos_brand/create | GposBrandController.detailPesanan | YES | N/A | YES | NO | NO | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S097 | GET `/gpos-brand` | gpos_brand/list | GposBrandController.index | YES | YES | YES | YES | YES (Superadmin) | NO (manual/none) | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S098 | GET `/loyalty-member/:id` | loyalty-member/program-principal-list | LoyaltyMemberController.programByPrincipalList | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S099 | GET `/loyalty-member/:id/voucher` | loyalty-member/detail-program/create | LoyaltyMemberController.createProgramDetailByPrincipal | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S100 | GET `/loyalty-member/:id/point` | loyalty-member/detail-program/create | LoyaltyMemberController.createProgramDetailByPrincipal | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S101 | GET `/loyalty-member/:id/:program/:type` | loyalty-member/detail-program/edit | LoyaltyMemberController.programDetailByPrincipal | YES | N/A | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S102 | GET `/loyalty-member` | loyalty-member/list | LoyaltyMemberController.index | YES | N/A | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S103 | GET `/user-verification` | user_verification/list | UserVerificationController.index | YES | UNKNOWN | NO | YES | YES (Superadmin) | N/A | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S104 | GET `/personalization/channels` | personalization/channels/list | PersonalizationChannelController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S105 | GET `/personalization/channels/:id` | personalization/channels/create | PersonalizationChannelController.createPage | YES | YES | YES | YES | NO | YES | ACTIVE-CANDIDATE | views.json / ctrl.json |
| S106 | GET `/` | login | AuthController.getLogin | NO | N/A | YES | NO | NO | YES | ACTIVE-CANDIDATE | AuthController.js:9-16 (also every action's checkAuth fallback) |
| S107 | GET `/product-gposb2b` | product_gposb2bs/edit | ProductGposb2bController.index | YES | YES | YES | YES | YES (Superadmin) | YES | ACTIVE-CANDIDATE | index delegates to edit() (ProductGposb2bController.js:17-20) |

Status totals: **ACTIVE-CANDIDATE 82 · UNKNOWN 22 · MISSING-VIEW 3** (107 screens).

## 23. Feature Inventory (A1.23)

| # | Feature (legacy label) | Screens | Main routes | Capabilities | Dependencies | Shared components / JS / mappers | Status |
|---|---|---|---|---|---|---|---|
| F01 | Login / sesi | S106 | `/`, `/login`, `/logout` | Login, logout | AuthRepository, session | — | ACTIVE |
| F02 | Beranda | S001 | `/home` | Static widgets | — | Chart.js (dead) | ACTIVE (static) |
| F03 | Order/Pesanan | S007, S008 | `/order*` | List, structured search, sync, delete (broken), detail | OrderRepository | buildtable, OrderMapper | ACTIVE |
| F04 | Order Review | S012, S013 | `/order-review*` | List, detail | — | buildtable, OrderReviewMapper | ACTIVE |
| F05 | Pembayaran | S085, S086 | `/payment*` | List, filter, detail, trigger | — | buildtable, PaymentMapper, datepicker | ACTIVE |
| F06 | Inventory/Persediaan | S075-S077 | `/inventories*` | CRUD, stock modal | Product search | buildtable, new_alertdel | ACTIVE |
| F07 | Produk | S045, S046 | `/products*` | List, filter, edit, 4 images | — | buildtable, uploader | ACTIVE |
| F08 | Kategori Produk | S047-S049 | `/product-category*` | CRUD, image | — | buildtable, uploader | ACTIVE |
| F09 | Produk Gpos B2b | S107/S032, S033-S035 | `/product-gposb2b*`, `/product-gposb2b-homepage*` | Config, homepage products, criteria | GlobalConfiguration, CustomCriteria | buildtable, PGH mapper | ACTIVE (+3 MISSING-VIEW) |
| F10 | Personalisasi Katalog | S026-S031, S036-S038 | `/custom-catalog*`, `/custom-catalog-product-homepage*`, `/custom-criteria*` | CRUD, inline edit, products, criteria | OPTIONS routes | buildtable, 3 mappers | ACTIVE (+6 UNKNOWN) |
| F11 | Pembatasan produk | S081-S083 | `/product-restrictions*` | CRUD | Channel types | buildtable | ACTIVE |
| F12 | Loyalty Member | S098-S102 | `/loyalty-member*` | Cards, programs, CSV | Gamification upload-csv | loyalty_card, pagination.js, uploader | ACTIVE |
| F13 | Poin & Voucher: Pengaturan Poin | S050-S060, S065 | `/poin-voucher*`, `/poin-voucher/setting-point*` | List, wizard, edit, toggle | PoinVoucherHelper | pagination.js, form_datetimepicker | ACTIVE (+5 mockups) |
| F14 | Poin & Voucher: Inject Poin | S061-S063 | `/poin-voucher/inject-point*` | List, cancel, wizard | Customer lookup | buildtable, InjectPoinMapper | UNKNOWN (no navigation) |
| F15 | Poin & Voucher: Mutasi & Redeem | S064 | `/poin-voucher/redeem*` | Filtered list | UserManagement lookup | buildtable, MutasiRedeemPoinMapper | UNKNOWN (no navigation) |
| F16 | Poin & Voucher: Voucher Setting | S066-S071 | `/voucher-setting*` | Categories, vouchers, wizard, toggle | VoucherRepository | uploader | UNKNOWN (no navigation) |
| F17 | Push Notification | S009-S011 | `/notification*` | Card list, CRUD, schedule, cancel/final, preview | — | buildtable, NotificationMapper | ACTIVE |
| F18 | Banner & Iklan | S017-S019 | `/banner*` | List, filters, inline edit, CRUD, criteria | OPTIONS routes | buildtable, BannerMapper, Quill, uploader | ACTIVE |
| F19 | Group Story | S020-S022 | `/group-story*` | List, inline edit, CRUD, banner picker | Banner list | buildtable, uploader | ACTIVE |
| F20 | Produk Sponsor | S078-S080 | `/sponsored-products*` | CRUD | ProductCategory | buildtable | ACTIVE |
| F21 | Gamification | S088-S093 | `/gamification*` | List, create, edit, duplicate, CSV, rewards, status | Voucher list, OSS | pagination.js, uploader, modals | ACTIVE (+1 UNKNOWN) |
| F22 | Voucher Pengiriman | S094, S095 | `/gpos-brand/shipping-voucher*` | List, create, cancel | — | buildtable | ACTIVE |
| F23 | GPOS Brand | S096, S097 | `/gpos-brand*` | Order list, processing, cancel | — | buildtable, GposBrandMapper | ACTIVE |
| F24 | Kode Telesales | S023-S025 | `/referral-code*` | CRUD, bulk delete | Channel types | buildtable (GET), ReferralCodeMapper | ACTIVE |
| F25 | Grup Pelanggan | S072-S074 | `/customer-groups*` | CRUD (JSON) | cust-id options | buildtable | ACTIVE |
| F26 | Konfigurasi Channel | S104, S105 | `/personalization/channels*` | List, wizard, products, preview | Many OPTIONS routes | buildtable, PersonalizationChannelMapper, mobile previews | ACTIVE |
| F27 | Verifikasi Akun | S103 | `/user-verification*` | List, review, approve/reject/update, export | — | buildtable, UserVerificationMapper | ACTIVE |
| F28 | Prinsipal | S002-S004 | `/principal*` | CRUD, local image | — | buildtable, Choices | ACTIVE |
| F29 | Pendaftaran Folamil | S087 | `/register-folamil` | CSV upload | Loyalty point types | uploader | ACTIVE |
| F30 | Konfigurasi Umum | S014-S016 | `/global-configuration*` | CRUD | — | buildtable, GlobalConfigurationMapper | ACTIVE |
| F31 | Manajemen Pengguna | S084 | `/user-management*` | List, branch filter, toggle, export | — | buildtable, UserManagementMapper | ACTIVE |
| F32 | Bantuan Pengguna (Masukan / Konten / FAQ) | S005, S006, S039-S044 | `/feedback*`, `/content*`, `/faqs*` | List, edit, CRUD | — | buildtable | ACTIVE |

**Endpoints shared across features (OPTIONS):**
- `/banner/{cust-id, aam-cust-id, branch, channel-type, platform-options}`
- `/products/{options, search, lini-options, sublini-options}`
- `/principal/options`, `/product-category/options`, `/catalog/options`, `/tc/options`, `/tc/sub/options`, `/product-class/options`
- `/custom-catalogs/options`, `/customer-groups/options`
- `/gamification/options/*`, `/poin-voucher/redeem/point-types`
- `/files/signurl`

## 24. Orphan View Analysis (A1.24)

| View | Why it is orphaned | Possible parent | Static refs | Dynamic refs | Related controller | Status | Evidence |
|---|---|---|---|---|---|---|---|
| components/form_time | Never `@component`'d | — | 0 | None | — | LIKELY UNUSED | grep |
| components/list_paginate | Never referenced; hardcoded "140 entries" | — | 0 | None | — | LIKELY UNUSED | grep |
| components/paginate | Never referenced; a server-side port of pagination.js | — | 0 | None | — | LIKELY UNUSED | grep |
| custom_catalogs/tabs/custom_catalog_product_homepage_edit | Replaced by the inline collapse tab; its `new-product-modal` button has no handler | S028 (older version) | 0 | None | CCPH | LIKELY UNUSED | G2 |
| custom_catalogs/tabs/custom_criteria_edit | Replaced; posts to the undefined `CustomCriteriaController.update`; its option lists only exist in commented-out PGH code | S028 (older) / PGH edit | 0 | None | CustomCriteria / PGH (commented) | LIKELY UNUSED | G2 |
| gamification/tmp | Stale snapshot of `edit.edge` | S092 | 0 | None | Gamification | LIKELY UNUSED | diff; mtime |
| personalization/channels/edit | Earlier version of the wizard; all its endpoints are `/cms/personalization/*`, which have no routes | S105 | 0 | None | — | LIKELY UNUSED | G5 |
| personalization/channels/edit copy | Copy of the file above | S105 | 0 | None | — | LIKELY UNUSED | file name + endpoints |
| poin_voucher/voucher_setting/voucher_digital/list | Prototype replaced by `voucher_category_view`; linked only from commented-out cards | S066 | Commented only | None (every render uses a fixed string) | Handlers missing | LIKELY UNUSED | G3 |
| …/voucher_e-wallet/list | Same as above | S066 | Commented only | None | — | LIKELY UNUSED | G3 |
| …/voucher_folamil/list | Same as above | S066 | Commented only | None | — | LIKELY UNUSED | G3 |
| …/voucher_listrik/list | Same as above | S066 | Commented only | None | — | LIKELY UNUSED | G3 |
| …/voucher_pulsa/list | Same; uses variables that no controller provides | S066 | Commented only | None | `createPulsa` (missing) | LIKELY UNUSED | G3 |
| …/voucher_pulsa/create | Replaced by `voucher_category/create`; posts to the missing `createPulsaSummary` | S067 | 0 | None | — | LIKELY UNUSED | G3 |
| …/voucher_pulsa/create_summary | Same; its modal form has `action="#"` | S068 | 0 | None | — | LIKELY UNUSED | G3 |
| user_management/create | Copy of the custom catalog create page; the controller's `create` is commented out | — | 0 | None | Commented out | LIKELY UNUSED | G5 |
| user_management/edit | Copy of the custom catalog edit page; the controller's `edit` is commented out | — | 0 | None | Commented out | LIKELY UNUSED | G5 |
| user_management/tabs/custom_catalog_create | Byte-identical to the `custom_catalogs/tabs` version | — | 0 | None | — | LIKELY UNUSED | diff |
| user_management/tabs/custom_catalog_edit | Identical copy | — | 0 | None | — | LIKELY UNUSED | diff |
| user_management/tabs/custom_catalog_product_homepage | Identical copy | — | 0 | None | — | LIKELY UNUSED | diff |
| user_management/tabs/custom_criteria | Identical copy | — | 0 | None | — | LIKELY UNUSED | diff |

**Result:** all 21 are LIKELY UNUSED. None turned out to be an active screen, a partial, or a dynamic include.

**Routed views that are only mockups (not orphans):** `setting_point/create_point_{reguler, payment, payment_summary, folamil, folamil_summary}`, i.e. S050-S052, S057 and S058. Their status is UNKNOWN.

## 25. Missing View Analysis (A1.25)

| Item | Finding | Evidence |
|---|---|---|
| Routes | Resource `product-gposb2b-homepage` + GET index + POST datatable / delete / multidelete | `routes.js:164-183` |
| Controller | `index`, `create` and `edit` render `product_gposb2b_homepages/{list,create,edit}` | `ProductGposb2bHomepageController.js:20,53,139` |
| Expected path | `resources/views/product_gposb2b_homepages/` | **Directory does not exist** |
| Other defects | `edit` assigns an undeclared variable (probably a ReferenceError); `update` calls a mapper method that doesn't exist; `show` and `destroy` are undefined; the options action has no route | G2 |
| Assets / menu | None. The "Produk Gpos B2b" menu item goes to `ProductGposb2bController.index` instead | Extender.js |
| Working UI for the same capability | Tab 2 of S107 (`product_gposb2bs/tabs/product_gposb2b_homepage.edge`) uses the PGH create / datatable / delete / multidelete routes | G2 |
| Mapper | `ProductGposb2bHomepageMapper` (Delete-only cells) | mapper.json |
| API | `/api/v1/cms/product-gposb2b-homepages` | Repository |
| Status | S033-S035 **MISSING-VIEW** | — |

## 26. Unknown / Verify Later (A1.26)

| ID | Unknown | Phase |
|---|---|---|
| U01 | What `route()` outputs for non-existent handlers (probably the literal `null`): `UserController.*`, `HomeController.getDashboard`, `SalesOrderController.getSalesChart`, `OrderController.delete`, `ProductController.multidelete/destroy`, `customCriteriaController.index`, `MutasiRedeemPoinController.redeemPointReguler`, `PoinVoucherController.searchFilterReguler`, `PoinVoucherSettingVoucherController.voucher*Index/createPulsa*`, `Personalization/ChannelCmsController.index`, `UserManagementController.multidelete` | A3.1 |
| U02 | What happens when the 97 resource-derived routes and the 3 explicit routes without an action are called | A3.1 |
| U03 | Error page shown for the missing views of S033-S035 | A3.1 |
| U04 | The real menu each account gets, and whether Payment/Marketing users can reach and use hidden screens | A2 / A3.1 |
| U05 | Session payload returned by the gateway login | A2 |
| U06 | Request/response contract of each datatable endpoint, including empty-response shapes | A2 |
| U07 | Whether Order bulk delete and row delete fail at runtime | A3.1 |
| U08 | Whether pressing Enter in the custom catalog sequence field deactivates the catalog | A3.1 |
| U09 | Whether `/product-gposb2b` loops when the config API fails | A3.1 |
| U10 | How Edge renders `@json(...)` in `product_restrictions/edit` | A3.1 |
| U11 | Whether `program_trigger_type` is submitted as an array | A3.1 |
| U12 | Loyalty `required_purchase` vs `required_purchases`; whether publishing a voucher program fails validation | A2 / A3.1 |
| U13 | Whether the `$.fn.customDataTable` regex on S098 works | A3.1 |
| U14 | Notification `final` calling the cancel endpoint; ONETIME date inputs being disabled | A2 / A3.1 |
| U15 | Gamification `principal_ids` collapsing to one value on create | A3.1 |
| U16 | Personalization endpoints answering `redirect('back')`, so failures may look like success | A3.1 |
| U17 | Whether channel list `loadData()` overwrites the DataTables rows | A3.2 |
| U18 | Which default the Referral "Dan/Atau" radio ends up with | A3.1 |
| U19 | Runtime and visual behavior of the screens with no navigation entry | A3.2 |
| U20 | CDN library versions served at runtime (toastr `latest`, Quill, Toastify, Swiper) | A3.2 |
| U21 | Whether browser exports cover only the current page | A3.2 |
| U22 | `view.render('login')` ReferenceErrors where `view` isn't destructured | A3.1 |
| U23 | `GET /loyalty-member/create` being caught by `/:id` | A3.1 |
| U24 | Payment list TypeError when `receipts` is empty; null maps on the payment detail | A3.1 |
| U25 | Upload ratio check not blocking; `accept` being undefined and throwing | A3.1 |
| U26 | Whether `public/images`, `downloads` or `uploads` are referenced by API data | A2 |
| U27 | `formatRupiah` values inside number inputs on GPOS Brand | A3.2 |
| U28 | Where the `DateComparison` custom rule is registered and used | A2 |
| U29 | Mobile dropdown `{{ fullname }}` rendering empty | A3.2 |
| U30 | Datatable `catch` → `redirect('back')` behavior inside DataTables | A3.1 |

Total: **30 unknowns**.

## 27. Findings

| ID | Sev | Title | Location | Evidence | Current behavior | Migration impact | Recommendation (scope only) |
|---|---|---|---|---|---|---|---|
| A1-F01 | HIGH | Failure flash messages silently lost | Many controllers use the `Warning` key; list views render only `notification` | Deep reads; §18 | No error is shown after a failed update or delete | The legacy error UX can't be used as the spec | A2: derive the intended messages from the flash texts |
| A1-F02 | HIGH | Inverted bulk-delete flashes | `ContentController.multidelete`, `OrderReviewController.multidelete` | `Content:184-188`, `OrderReview:71-75` | Success shows nothing; failure shows "Berhasil" | Don't copy this behavior | Record as a defect |
| A1-F03 | HIGH | Broken destructive actions | Order bulk and row delete, Product delete wiring, UserManagement multidelete | G1 / G2 / G5 | The action fails | Unclear whether these capabilities are in scope | A2 business confirmation |
| A1-F04 | HIGH | Wrong redirect after deleting a principal | `PrincipalController.js:180` → `/custom-catalog` | [SOURCE] | The user lands on another feature | Don't preserve | Record |
| A1-F05 | HIGH | Screens reachable only by URL | Inject Point, Mutasi/Redeem, Voucher Setting, Gamification multi, CCPH / CustomCriteria standalone | Commented-out cards; no menu entry | Hidden but mostly functional | Whether they are in scope is undecided | Owner decision before A4 |
| A1-F06 | HIGH | Login view ships prefilled credentials (same as A0-F04) | `login.edge:56,64` | [SOURCE] | Credentials are in the HTML | Exclude | Carry forward |
| A1-F07 | MEDIUM | JSON endpoints answer with a redirect or HTML | Personalization, datatable catch blocks, several stores | G4 / G5 | AJAX callers receive HTML with status 200 | The error contract is ambiguous | A2 contract |
| A1-F08 | MEDIUM | Browser export covers only the current page | `main.js` buttons + serverSide | [INFERRED] | Export contains at most one page of rows | Export expectations unclear | A3 verify; A2 decide |
| A1-F09 | MEDIUM | Validation messages hidden | Components without `showError`; Content; FAQ `old()` | Components | Only red borders | Error-display requirements unclear | A2 |
| A1-F10 | MEDIUM | Links and actions pointing to non-existent handlers | U01 | [SOURCE] | `null` hrefs or errors | Navigation and actions incomplete | A3 verify |
| A1-F11 | MEDIUM | Filter parameters dropped on the server | Mutasi `mutation_type` / `no_invoice`; Loyalty search; CustomCatalog `sort_by` offset; branch overriding customers | Mappers | Filters appear in the UI but have no effect | Legacy behavior differs from what the UI promises | A2 |
| A1-F12 | MEDIUM | Static mockups have live routes | S050-S052, S057, S058 | [SOURCE] | Non-functional pages | Exclude unless confirmed | A3 + owner |
| A1-F13 | MEDIUM | Missing views for the standalone PGH screens | §25 | [SOURCE] | Runtime error | The capability already exists in the S107 tab | Treat S107 as the spec |
| A1-F14 | MEDIUM | Principal images saved to local disk | `PrincipalController.store` | [SOURCE] | Differs from the OSS flow | Storage behavior to be decided | A2 |
| A1-F15 | MEDIUM | Upload errors invisible; ratio check does not block | `script_image_uploader.edge` | [SOURCE / INFERRED] | Errors only in the console | UX gap | A3 |
| A1-F16 | LOW | Dashboard is placeholders only | S001 | [SOURCE] | Zeros; the chart never draws | Small home scope | Record |
| A1-F17 | LOW | 21 orphan views LIKELY UNUSED | §24 | diff / grep | Stale copies | Exclude | Confirm in A3 |
| A1-F18 | LOW | Unused `main.js` helpers | `.price-format`, `toIDR`, `.content-richtext`, Choices init | grep | Dead code | None | Exclude |
| A1-F19 | INFO | No role/email logic in server-built UI | §8 | mapper.json | Visibility is controlled only by the menu | Permissions live elsewhere (A2) | — |
| A1-F20 | INFO | Stray `PoinVoucherMapper copy.js` | `app/Mapper` | ls | Unused | None | — |

No CRITICAL finding blocks A2.

## 28. Evidence Index

| Ref | Source | Content |
|---|---|---|
| E1 | `start/routes.js` | 247 route calls → 427 entries (`/tmp/a1/routes2.json`) |
| E2 | `app/Controllers/Http/*.js` (41 files) | Actions, renders, redirects, flashes, validators (`/tmp/a1/ctrl.json`) |
| E3 | `resources/views/**/*.edge` (191 files) | Components, includes, forms, buildtable calls, AJAX URLs, modals (`/tmp/a1/views.json`) |
| E4 | `app/Mapper*/**` + controllers/helpers that emit HTML | 34 functions (`/tmp/a1/mapper.json`) |
| E5 | `app/Validators/**` (47 files) | Rules and messages (`/tmp/a1/validators.json`) |
| E6 | `app/Middleware/Extender.js` | The 3 menu sets (`/tmp/a1/menu.json`) |
| E7 | `public/assets/js/{main,cms-toastify,pagination}.js` | Shared helpers |
| E8 | `layouts.edge`, `login.edge`, `dashboard.edge` | Shell, navigation, login, dashboard |
| E9 | `script_image_uploader.edge`, `form_image.edge`, `FileController.js` | Upload flow |
| E10 | `node_modules/@adonisjs/framework/src/View/globals.js:18-29`, `src/Route/Manager.js:393-395` | How `route()` behaves for unknown handlers [INFERRED] |
| E11 | Deep reads G1-G6: Transaksi; Produk & Katalog; Poin/Voucher/Loyalty; Engagement; Settings; Help/Auth/Shell | The file:line citations in §§6-25 |

## 29. GO / NO-GO

**GO.** The screen scope is fully identified:
- All 330 frontend-relevant routes are classified.
- All 107 screens are mapped, with completeness columns filled in.
- All 191 views have a status, including the 21 orphans and the 3 missing views.
- Navigation, forms, modals, uploads, exports, validation and redirect behavior are inventoried.

What remains are behavioral or runtime questions (U01-U30), assigned to A2 and A3.

**Owner decisions needed:**
- Whether the screens with no navigation entry are in scope: F14-F16, Gamification multi-period, and the standalone CCPH / CustomCriteria screens.
- Whether the mockup screens are in scope.
- Whether the broken destructive actions should exist in the new app.
