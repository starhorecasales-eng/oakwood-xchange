# Oakwood Xchange — Cebimde Kur

Mobil öncelikli, kurulabilir GBP/TRY kur dönüştürücü. Canlı kur alınamazsa kullanıcıyı bekletmeden tarayıcıda saklanan son geçerli kurla çalışmaya devam eder.

Canlı adres: [xchange.oakwoodapps.co.uk](https://xchange.oakwoodapps.co.uk)

## Özellikler

- TRY → GBP ve GBP → TRY anlık hesaplama
- Frankfurter üzerinden canlı gösterge kuru; API anahtarı yok
- Üç saniyelik ağ zaman aşımı ve son geçerli kur yedeği
- PWA kurulumu ve çevrimdışı uygulama kabuğu
- Otuz saniyelik yenileme sınırı ve kur veri doğrulaması
- Sabit hedefli HTTPS yönlendirmesi ve güvenlik başlıkları
- Windows üzerinde düşük yetkili, korumalı statik servis dağıtımı

## Yerel geliştirme

Node.js 22.13 veya daha yeni bir sürüm gerekir.

```powershell
npm.cmd ci
npm.cmd run dev
```

Kontroller:

```powershell
npm.cmd test
npm.cmd run lint
```

`npm test`, üretim derlemesini ve statik HTML çıktısını üretir; ardından sayfa, PWA, HTTPS ve güvenlik başlığı testlerini çalıştırır.

## Windows dağıtımı

Üretim derlemesi hazırlandıktan sonra yönetici PowerShell ile:

```powershell
.\ops\deploy-protected-service.ps1
```

Betik, dağıtımı `C:\Program Files\OakwoodApps\Xchange` altına kopyalar; yazma izinlerini sınırlar ve `OakwoodXchange` servisini `LocalService` hesabına taşır. Sağlık kontrolü başarısız olursa eski servis ayarlarını geri yükler.

Cloudflare Tunnel kuralları [ops/cloudflared.yml](ops/cloudflared.yml) içindedir. Tünel kimlik dosyası depoya eklenmez.

## Güvenlik ve veri

- Uygulamada üyelik, ödeme veya kullanıcı hesabı yoktur.
- Tutarlar sunucuya kaydedilmez.
- Kur sağlayıcısı tarayıcıdan doğrudan çağrılır ve gizli API anahtarı kullanılmaz.
- Güvenlik bildirimi için [SECURITY.md](SECURITY.md) dosyasını kullanın.
