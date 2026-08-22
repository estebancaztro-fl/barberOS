import "./globals.css";
import { DataProvider } from "@/lib/store";
import { SesionProvider } from "@/lib/sesion";
import Protegido from "@/components/Protegido";

export const metadata = {
  title: "BarberOS · Ordena tu barbería sin dejar la tijera",
  description:
    "Agenda, clientes y finanzas en un solo lugar, más visagismo digital e historial de cortes. 14 días gratis, sin tarjeta.",
  openGraph: {
    title: "BarberOS · Ordena tu barbería sin dejar la tijera",
    description:
      "Agenda online, ficha de cada cliente, comisiones calculadas solas y análisis de rostro para recomendar el corte.",
    type: "website",
    locale: "es_CL",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1d1919",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <SesionProvider>
          <DataProvider>
            <Protegido>{children}</Protegido>
          </DataProvider>
        </SesionProvider>
      </body>
    </html>
  );
}
