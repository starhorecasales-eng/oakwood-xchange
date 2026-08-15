import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { parseConversionRoute } from "@/lib/conversion-route";
import { CURRENCIES } from "@/lib/currency";
import { createMoney, formatMoney } from "@/lib/money";
import { PRODUCT_IDENTITY } from "@/lib/product";
import { convertMoney, rateBetween, rateFreshness } from "@/lib/rates";
import { getServerRateTable } from "@/lib/server-rates";

type RouteProps = {
  params: Promise<{ from: string; to: string; amount: string }>;
};

const conversionFor = cache(async (from: string, to: string, amount: string) => {
  const route = parseConversionRoute(from, to, amount);
  if (!route) return null;
  const table = await getServerRateTable();
  const result = convertMoney(createMoney(route.amount, route.from), route.to, table);
  return { route, table, result, freshness: rateFreshness(table) };
});

function amountLabel(amount: number, currency: string) {
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(amount)} ${currency}`;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const values = await params;
  const conversion = await conversionFor(values.from, values.to, values.amount);
  if (!conversion) return { title: "Geçersiz dönüşüm", robots: { index: false, follow: false } };

  const source = amountLabel(conversion.route.amount, conversion.route.from);
  const result = formatMoney(conversion.result, "tr-TR");
  return {
    title: `${source} kaç ${conversion.route.to}? ${result} | ${PRODUCT_IDENTITY.publicName}`,
    description: `${source}, ${conversion.table.date} tarihli gösterge kuruyla yaklaşık ${result} eder.`,
    alternates: {
      canonical: new URL(conversion.route.canonicalPath, PRODUCT_IDENTITY.canonicalOrigin),
    },
    robots: { index: false, follow: true },
  };
}

export default async function ConversionPage({ params }: RouteProps) {
  const values = await params;
  const conversion = await conversionFor(values.from, values.to, values.amount);
  if (!conversion) notFound();
  if (conversion.route.canonicalPath !== `/convert/${values.from}/${values.to}/${values.amount}`) {
    permanentRedirect(conversion.route.canonicalPath);
  }

  const source = amountLabel(conversion.route.amount, conversion.route.from);
  const result = formatMoney(conversion.result, "tr-TR");
  const unitRate = rateBetween(conversion.table, conversion.route.from, conversion.route.to);
  const rateLabel = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 6 }).format(unitRate);

  return (
    <main className="conversion-page">
      <article className="conversion-answer">
        <Link className="conversion-brand" href="/">{PRODUCT_IDENTITY.publicName}</Link>
        <p className="conversion-kicker">Hızlı fiyat çevirisi</p>
        <h1>{source} kaç {conversion.route.to}?</h1>
        <p className="conversion-result">{source} ≈ <strong>{result}</strong></p>
        <p className="conversion-rate">
          1 {conversion.route.from} = {rateLabel} {conversion.route.to}
        </p>
        <p className={conversion.freshness.state === "old" ? "conversion-warning" : "conversion-context"}>
          {conversion.freshness.state === "old" ? "Eski " : ""}Gösterge kuru: {conversion.table.date}.
          Banka, kart ve döviz bürosu kurları farklı olabilir.
        </p>
        <dl className="conversion-details">
          <div><dt>Kaynak para</dt><dd>{CURRENCIES[conversion.route.from].name}</dd></div>
          <div><dt>Hedef para</dt><dd>{CURRENCIES[conversion.route.to].name}</dd></div>
        </dl>
        <Link className="conversion-cta" href="/">Başka bir tutar hesapla</Link>
      </article>
    </main>
  );
}
