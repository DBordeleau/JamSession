import { Container } from "@/components/layout/container";
export default function LoadingStudio() {
  return (
    <main id="main-content">
      <Container className="py-16">
        <p role="status">Loading studio details…</p>
      </Container>
    </main>
  );
}
