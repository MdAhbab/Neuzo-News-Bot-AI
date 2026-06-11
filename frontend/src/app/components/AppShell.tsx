import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
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
];

const TODAY = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.health().then((h) => setHealthy(h.ok)).catch(() => setHealthy(false));
  }, []);
  useEffect(() => setOpen(false), [location.pathname]);

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
    </div>
  );
}
