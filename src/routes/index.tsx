import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Placement Portal" },
      {
        name: "description",
        content: "Student Placement Portal — a home for placement activity.",
      },
      { property: "og:title", content: "Student Placement Portal" },
      {
        property: "og:description",
        content: "Student Placement Portal — a home for placement activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-4">
          <h1 className="text-base font-semibold tracking-tight">
            Student Placement Portal
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {/* Empty shell — content added as the project develops. */}
      </main>
    </div>
  );
}
