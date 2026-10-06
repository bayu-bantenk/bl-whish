Below are all the pages that exist, in menu order. Base URL for the dev server: `http://localhost:4000`. Replace `[id]` with the record's id.

**Public (no login)**

| Page | Path |
|---|---|
| Login | `/login` |
| Forgot password | `/forgot` |
| Reset password | `/reset` |
| Register | `/register` |

`/forgot`, `/reset` and `/register` came from the template, not from this migration. I haven't checked whether they work.

**Dashboard**

| Menu | List | Create | Edit |
|---|---|---|---|
| Beranda | `/dashboard/home` | – | – |
| **Produk & Katalog** | | | |
| Produk (F07) | `/dashboard/product` | – | `/dashboard/product/update/[id]` |
| Kategori Produk (F08) | `/dashboard/product-category` | `/dashboard/product-category/create` | `/dashboard/product-category/update/[id]` |
| Pembatasan produk (F11) | `/dashboard/product-restriction` | `/dashboard/product-restriction/create` | `/dashboard/product-restriction/update/[id]` |
| **Interaksi Pelanggan** | | | |
| Banner & Iklan (F18) | `/dashboard/banner` | `/dashboard/banner/create` | `/dashboard/banner/update/[id]` |
| Group Story (F19) | `/dashboard/group-story` | `/dashboard/group-story/create` | `/dashboard/group-story/update/[id]` |
| Produk Sponsor (F20) | `/dashboard/sponsored-product` | `/dashboard/sponsored-product/create` | `/dashboard/sponsored-product/update/[id]` |
| **Pengaturan & Konfigurasi** | | | |
| Kode Telesales (F24) | `/dashboard/telesales-code` | `/dashboard/telesales-code/create` | `/dashboard/telesales-code/update/[id]` |
| Grup Pelanggan (F25) | `/dashboard/customer-group` | `/dashboard/customer-group/create` | `/dashboard/customer-group/update/[id]` |
| Prinsipal (F28) | `/dashboard/principal` | `/dashboard/principal/create` | `/dashboard/principal/update/[id]` |
| Konfigurasi Umum (F30) | `/dashboard/global-configuration` | `/dashboard/global-configuration/create` | `/dashboard/global-configuration/update/[id]` |
| **Bantuan Pengguna** | | | |
| Masukan (F32) | `/dashboard/feedback` | – | `/dashboard/feedback/update/[id]` (respond) |
| Konten (F32) | `/dashboard/content` | `/dashboard/content/create` | `/dashboard/content/update/[id]` |
| FAQ (F32) | `/dashboard/faq` | `/dashboard/faq/create` | `/dashboard/faq/update/[id]` |

**Not built yet**

`/dashboard/payment` and `/dashboard/payment/detail/[id]` are registered as planned and return 404. Any other unknown path under `/dashboard` also shows the 404 page inside the dashboard shell, and `/dashboard` itself redirects to `/dashboard/home`.

There are no separate delete or detail pages; delete is done from the list's confirm dialog.

**Access:** each page needs the module's capability (`<module>.read`, plus `.create` or `.update` for the form pages). If those capabilities aren't in `AUTHZ_INTERIM_GRANTS`, the page shows a 403 and the menu item is hidden.
