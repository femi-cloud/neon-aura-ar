import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { AuraExperience } from "@/components/aura/AuraExperience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Aura AR — Mystical Rainbow Edition" },
      {
        name: "description",
        content:
          "An immersive in-browser AR ritual: real-time hand tracking turns your gestures into neon particles, shockwaves, and lightning.",
      },
      { property: "og:title", content: "Neon Aura AR — Mystical Rainbow Edition" },
      {
        property: "og:description",
        content:
          "Real-time hand-tracking AR built with MediaPipe. Open palms summon auras, pinches launch shockwaves, two hands arc lightning.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="fixed inset-0 bg-black" />}>
      <AuraExperience />
    </ClientOnly>
  );
}
