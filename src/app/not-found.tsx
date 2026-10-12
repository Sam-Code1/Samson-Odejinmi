import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";

export default function NotFound() {
  return (
    <main id="main">
      <Container>
        <StateMessage title="That page doesn't exist" body="The link may be old, or the page may have moved." action={{ href: "/", label: "Back to home" }} secondary={{ href: "/academy", label: "Visit the Academy" }} />
      </Container>
    </main>
  );
}
