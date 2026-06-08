import { Plus } from "lucide-react";

export function ChatTabs() {
  return (
    <nav className="sticky top-20 z-10 flex h-12 shrink-0 items-center gap-8 border-b border-outline-variant/20 bg-surface/95 px-8 backdrop-blur-xl">
      <a
        className="h-full flex items-center text-sm font-body-bold text-primary border-b-2 border-primary px-1"
        href="#"
      >
        Chat
      </a>
      <a
        className="h-full flex items-center text-sm font-body-bold text-on-surface-variant hover:text-primary transition-colors px-1"
        href="#"
      >
        Files
      </a>
    </nav>
  );
}
