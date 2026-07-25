import "./globals.css";
import { DataProvider } from "@/lib/store";

export const metadata = {
  title: "BarberOS · SaaS para barberías",
  description: "Gestión de agenda, clientes, finanzas y CRM para barberías",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}
