export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>PowerCamp Pix Automático</h1>
      <p>
        API pronta: /api/pix-auto/rec, /api/pix-auto/solicrec,
        /api/pix-auto/cobr
      </p>
      <p>Webhooks: /api/webhooks/efi/rec, /api/webhooks/efi/cobr</p>
    </main>
  );
}
