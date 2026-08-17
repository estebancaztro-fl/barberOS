import "./globals.css";
import { DataProvider } from "@/lib/store";
import { SesionProvider } from "@/lib/sesion";
import Protegido from "@/components/Protegido";

export const metadata = {
  title: "BarberOS · SaaS para barberías",
  description: "Gestión de agenda, clientes, finanzas y CRM para barberías",
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
