import { Command } from "cmdk";
import {
  BarChart3,
  Clock,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import * as api from "../lib/api";
import { useAuth } from "../lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Logo } from "./common";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "./ui/utils";

const NAV = [
  { to: "/app", label: "Desk", end: true },
  { to: "/app/briefing", label: "Briefing", end: false },
  { to: "/app/history", label: "Archive", end: false },
  { to: "/app/analytics", label: "Analytics", end: false },
];

const TODAY = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    api.health().then((h) => setHealthy(h.ok)).catch(() => setHealthy(false));
  }, []);
  useEffect(() => setOpen(false), [location.pathname]);

  // ⌘K / Ctrl+K toggles the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/app" className="shrink-0 text-2xl">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-sm px-3 py-1.5 text-sm transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="rounded-sm border border-border px-1">⌘K</kbd>
            </button>

            <span className="hidden items-center gap-2 font-mono text-xs text-muted-foreground lg:flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  healthy === null ? "bg-muted-foreground" : healthy ? "bg-conf-high blink" : "bg-destructive",
                )}
              />
              {TODAY}
            </span>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-sm border border-border py-1 pl-1 pr-2.5 text-sm text-foreground outline-none hover:bg-secondary">
                <span className="grid h-7 w-7 place-items-center rounded-sm bg-primary/10 font-mono text-xs text-primary">
                  {(user?.name ?? "U").slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden max-w-[120px] truncate sm:block">{user?.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    signOut();
                    navigate("/auth");
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button className="text-foreground md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-border px-4 py-2 md:hidden">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn("block rounded-sm px-3 py-2.5 text-sm", isActive ? "text-primary" : "text-muted-foreground")
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const itemCls =
    "flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground aria-selected:bg-secondary aria-selected:text-foreground";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-foreground/40 p-4 pt-[14vh] backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" className="font-body">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search…"
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No results.</Command.Empty>

            <Command.Group heading="Navigate" className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Item className={itemCls} onSelect={() => go("/app")}>
                <Newspaper className="h-4 w-4" /> Desk
              </Command.Item>
              <Command.Item className={itemCls} onSelect={() => go("/app/briefing")}>
                <Sparkles className="h-4 w-4" /> Daily Briefing
              </Command.Item>
              <Command.Item className={itemCls} onSelect={() => go("/app/history")}>
                <Clock className="h-4 w-4" /> Archive
              </Command.Item>
              <Command.Item className={itemCls} onSelect={() => go("/app/analytics")}>
                <BarChart3 className="h-4 w-4" /> Analytics
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Actions" className="mt-1 px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Item className={itemCls} onSelect={() => go("/app")}>
                <Newspaper className="h-4 w-4" /> New report
              </Command.Item>
              <Command.Item
                className={itemCls}
                onSelect={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  onClose();
                }}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Toggle theme
              </Command.Item>
              <Command.Item
                className={cn(itemCls, "text-destructive aria-selected:text-destructive")}
                onSelect={() => {
                  onClose();
                  signOut();
                  navigate("/auth");
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
