<div align="center">

<img src="docs/01-kapak.png" alt="Toros Forge: Kızılgeçit — Enes Öztürk imzalı 3B deneyim" width="100%">

# Toros Forge: Kızılgeçit

**Enes Öztürk imzalı; ocağı harlayıp Şam çeliği dövdüğünüz, kendi ellerinizle yaptığınız silahlarla Toros geçitlerini kuşatmaya karşı savunduğunuz 3B demircilik aksiyonu.**

[![Doğrulama](https://img.shields.io/badge/Do%C4%9Frulama-lint%20%2B%20build%20ge%C3%A7ti-2EA043?style=for-the-badge)](https://github.com/EnesBinMalik/toros-forge-masters-anvil-kizilgecit)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=for-the-badge)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6-3178C6?logo=typescript&logoColor=white&style=for-the-badge)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.187-050505?logo=three.js&logoColor=white&style=for-the-badge)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white&style=for-the-badge)](https://vite.dev/)

[![Enes Öztürk](https://img.shields.io/badge/Enes%20%C3%96zt%C3%BCrk-imzal%C4%B1-EA4338?style=for-the-badge&logo=badge&logoColor=white)](https://github.com/EnesBinMalik)
[![Tür](https://img.shields.io/badge/T%C3%BCr-3B%20Deneyim-38BDF8?style=for-the-badge)](https://github.com/EnesBinMalik/toros-forge-masters-anvil-kizilgecit)
[![Durum](https://img.shields.io/badge/Durum-Tamamland%C4%B1-2EA043?style=for-the-badge)](https://github.com/EnesBinMalik/toros-forge-masters-anvil-kizilgecit)
[![Lisans](https://img.shields.io/badge/Lisans-T%C3%BCm%20Haklar%20Sakl%C4%B1%C4%9F%C4%B1-6E7681?style=for-the-badge)](https://github.com/EnesBinMalik/toros-forge-masters-anvil-kizilgecit)

<img src="docs/rozet-enes-ozturk.png" alt="Enes Öztürk imzalı tasarım rozeti" width="420">

</div>

---

## Hakkında

**Toros Forge: Kızılgeçit**, demirciliğin doğrudan savunmaya dönüştüğü ayrı bir oyun deneyimidir. Ocağı harlar, çeliği tavına getirip örste döver, su fıçısına daldırarak bileylersiniz. Kuşatma öncüleri ve arbaletçiler geçide ilerlerken kazık barikatlarını onarır, sur okçularını desteklersiniz.

Dövdüğünüz **Şam Çeliği Kılıç ve Kalkan**, **Örs Dövme ve Zırh Kırıcı** ya da **Ağır Savaş Baltası** ile düşman hatlarını kırarsınız. Çelik soğuduysa yeniden ocakta ısıtmanız gerekir; dövme döngüsü canlı bir mekanik olarak oyunun merkezindedir. Tüm modeller, dokular ve ses sistemi **Three.js** ile sıfırdan yazılmıştır.

> Bu proje **Enes Öztürk** tarafından tasarlanmış, geliştirilmiş ve imzalanmıştır.

---

## Öne çıkan özellikler

| Özellik | Açıklama |
| --- | --- |
| **Canlı dövme döngüsü** | Isıt → örste döv → suya daldır → bileyle; çelik soğursa yeniden ısıt. |
| **Şam Çeliği silahlar** | Kılıç+kalkan, zırh kırıcı ve ağır balta için ayrı dövme tarifleri. |
| **Kazık barikatı onarımı** | `E` ile kapı önü ve köprübaşı barikatlarını güçlendirme. |
| **Sur okçuları** | Usta işi silah dövdüğünüzde sur savunmacıları desteğe katılır. |
| **Kuşatma dalgaları** | Öncüler ve arbaletçiler geçide doğru ilerler; savunma hattını koruyun. |
| **El yazması harita** | `M` ile cephe haritasını açıp mevzileri inceleme. |
| **Diegetik göstergeler** | Çelik sıcaklığı ve zırh bütünlüğü doğrudan teçhizatta okunur. |
| **İmzalı tasarım** | Baş Mimar Enes Öztürk'ün kişisel imzasını taşıyan özgün yapım. |

---

## Savunma hatları

| # | Cephe | Açıklama |
| --- | --- | --- |
| 01 | Kızılgeçit Kalesi | Ana üs, demirci atölyesi ve sur savunma hattı |
| 02 | Geçit Vadisi | Erzak, demir cevheri ve mühimmat menzili |
| 03 | Toros Geçidi İleri Gözetleme Karakolu | Güney boğazındaki ilk savunma ve gözetleme noktası |

Her bölge kendi fizik kuralları, ışıklandırması, dokusu ve akustik karakteriyle ayrı bir deneyim sunar.

---

## Kontroller

| Tuş | Aksiyon |
| --- | --- |
| `W` `A` `S` `D` | Hareket |
| `Sol tık` / `E` | Örste çelik dövme |
| `E` | Suya daldırıp su verme / barikat onarımı |
| `M` | Savunma haritasını aç / kapat |
| `F` | Etkileşim ve savunma eylemleri |
| `H` | Arayüzü gizle |

> Oyun sırasında arayüz tamamen kaldırılabilir: ekranda yalnızca dünya içi telemetri kalır.

---

## Galeri

<img src="docs/02-ekran.png" alt="Toros Forge: Kızılgeçit açılış ekranı" width="100%">

<img src="docs/03-ekran.png" alt="Toros Forge: Kızılgeçit oyun içi görünüm" width="100%">

<img src="docs/04-ekran.png" alt="Toros Forge: Kızılgeçit detay görünümü" width="100%">

---

## Kurulum

**Gereksinimler:** Node.js 20+ ve modern bir WebGL tarayıcı.

```bash
git clone https://github.com/EnesBinMalik/toros-forge-masters-anvil-kizilgecit.git
cd toros-forge-masters-anvil-kizilgecit
npm install
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde açılır.

> Oyun tamamen istemci tarafında çalışır; `.env.example` yalnızca AI Studio dağıtım şablonu içindir.

Diğer komutlar:

```bash
npm run build     # Üretim derlemesi (dist/)
npm run preview   # Derlemeyi yerelde önizle
npm run lint      # TypeScript tip kontrolü
```

---

## Teknik mimari

```text
src/engine/TorosEngine.ts        Oyun döngüsü ve kuşatma sistemi
src/engine/worldBuilder.ts       Cepheler ve savunma yapıları
src/engine/geometryBuilders.ts   Örs, ocak, barikat ve surlar
src/engine/textures.ts           Demirci ve kale dokuları
src/engine/audio.ts              Dövme ve kuşatma sesleri
src/components/GameHud.tsx       Dövme durumu ve göstergeler
src/components/ParchmentMapModal.tsx  El yazması harita
src/components/TitleScreen.tsx   İmzalı açılış ekranı
```

---

## İmza

<div align="center">

[![Geliştirici](https://img.shields.io/badge/Geli%C5%9Ftirici-Enes%20%C3%96zt%C3%BCrk-EA4338?style=for-the-badge&logo=github&logoColor=white)](https://github.com/EnesBinMalik)
[![İmza](https://img.shields.io/badge/%C4%B0mza-Enes%20%C3%96zt%C3%BCrk-FFD700?style=for-the-badge&logo=verified&logoColor=white)](https://github.com/EnesBinMalik)

**Bu kod, tasarım ve deneyim Enes Öztürk'ün kişisel imzasını taşır.**

© 2026 Enes Öztürk — Tüm hakları saklıdır.

</div>
