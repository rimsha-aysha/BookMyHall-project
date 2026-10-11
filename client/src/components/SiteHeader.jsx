import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLES } from "../constants/roles.js";
import { usePublicSettings } from "../hooks/usePublicSettings.js";
import Icon from "./Icon.jsx";

// Public browsing — guests and customers.
const PUBLIC_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/halls", label: "Halls" },
  { to: "/packages", label: "Packages" },
  { to: "/food", label: "Food" },
  { to: "/decorations", label: "Decorations" },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Past Events" },
];

const CATALOG_MENU = {
  label: "Catalog",
  perm: "catalogManagement",
  items: [
    { to: "/manage/halls", label: "Halls" },
    { to: "/manage/packages", label: "Packages" },
    { to: "/manage/food", label: "Food" },
    { to: "/manage/decorations", label: "Decorations" },
    { to: "/manage/services", label: "Services" },
  ],
};

// Staff workspaces. `perm` entries are hidden from Managers whose Owner has
// revoked that permission (the server enforces the same rules).
const STAFF_LINKS = {
  [ROLES.MANAGER]: [
    { to: "/manager", label: "Dashboard" },
    { to: "/manage/bookings", label: "Bookings", perm: "bookingManagement" },
    { to: "/manage/calendar", label: "Calendar", perm: "bookingManagement" },
    CATALOG_MENU,
    { to: "/manage/coordinators", label: "Coordinators", perm: "coordinatorManagement" },
    { to: "/manage/gallery", label: "Gallery", perm: "galleryManagement" },
  ],
  [ROLES.OWNER]: [
    { to: "/owner", label: "Dashboard" },
    { to: "/manage/bookings", label: "Bookings" },
    { to: "/manage/calendar", label: "Calendar" },
    CATALOG_MENU,
    {
      label: "Admin",
      items: [
        { to: "/manage/customers", label: "Customers" },
        { to: "/manage/payments", label: "Payments" },
        { to: "/manage/managers", label: "Managers" },
        { to: "/manage/coordinators", label: "Coordinators" },
        { to: "/manage/gallery", label: "Event gallery" },
        { to: "/manage/settings", label: "Settings" },
      ],
    },
  ],
  [ROLES.COORDINATOR]: [
    { to: "/coordinator", label: "My Events" },
    { to: "/coordinator/calendar", label: "Calendar" },
  ],
};

const NavMenu = ({ menu, pathname }) => {
  const active = menu.items.some((item) => pathname.startsWith(item.to));
  return (
    <details className={`nav-menu ${active ? "has-active" : ""}`}>
      <summary>
        {menu.label} <Icon name="chevronDown" size={14} />
      </summary>
      <div className="nav-menu-list">
        {menu.items.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </div>
    </details>
  );
};

// One header across the whole app; links depend on the signed-in role.
const SiteHeader = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [lastPath, setLastPath] = useState(location.pathname);
  const navRef = useRef(null);

  // Close the mobile menu whenever the route changes.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    if (open) setOpen(false);
  }

  // Close dropdown menus on navigation, outside click or Escape.
  useEffect(() => {
    const closeMenus = (except) =>
      navRef.current?.querySelectorAll("details[open]").forEach((d) => d !== except && d.removeAttribute("open"));
    closeMenus();
    const onClick = (e) => closeMenus(e.target.closest?.("details"));
    const onKey = (e) => e.key === "Escape" && closeMenus();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [location.pathname]);

  const { businessName } = usePublicSettings();
  const isStaff = user && user.role !== ROLES.CUSTOMER;
  const allowed = (l) => !l.perm || user.role !== ROLES.MANAGER || user.permissions?.[l.perm] !== false;
  const mainLinks = isStaff ? (STAFF_LINKS[user.role] || []).filter(allowed) : PUBLIC_LINKS;

  return (
    <header className="site-header">
      <div className="container">
        <div className="site-header-bar">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              {businessName.charAt(0)}
            </span>
            <span className="brand-name">{businessName}</span>
          </Link>
          <button
            type="button"
            className="menu-toggle button-ghost"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "x" : "menu"} size={20} />
            <span className="sr-only">Menu</span>
          </button>
        </div>

        <nav id="site-nav" ref={navRef} className={`site-nav ${open ? "open" : ""}`} aria-label="Main">
          <div className="site-nav-links">
            {mainLinks.map((l) =>
              l.items ? (
                <NavMenu key={l.label} menu={l} pathname={location.pathname} />
              ) : (
                <NavLink key={l.to} to={l.to} end={l.end || l.to === "/manager" || l.to === "/owner" || l.to === "/coordinator"}>
                  {l.label}
                </NavLink>
              )
            )}
          </div>
          <div className="site-nav-account">
            {!user && (
              <>
                <NavLink to="/login">Log in</NavLink>
                <NavLink to="/register" className="nav-cta">
                  Create account
                </NavLink>
              </>
            )}
            {user?.role === ROLES.CUSTOMER && (
              <>
                <NavLink to="/my-bookings">My Bookings</NavLink>
                <NavLink to="/booking" className="nav-cta">
                  Book an event
                </NavLink>
              </>
            )}
            {user && (
              <details className="nav-menu align-right account-menu">
                <summary title={user.email}>
                  <span className="nav-avatar" aria-hidden="true">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="nav-user">
                    <strong>{user.name.split(" ")[0]}</strong>
                    <span>{user.role}</span>
                  </span>
                  <Icon name="chevronDown" size={14} />
                </summary>
                <div className="nav-menu-list">
                  {user.role === ROLES.CUSTOMER && (
                    <NavLink to="/customer" end>
                      Dashboard
                    </NavLink>
                  )}
                  {user.role === ROLES.CUSTOMER && <NavLink to="/account">My profile</NavLink>}
                  {isStaff && <NavLink to="/halls">View public site</NavLink>}
                  <button
                    type="button"
                    className="nav-logout button-ghost"
                    onClick={() => {
                      logout();
                      navigate("/");
                    }}
                  >
                    <Icon name="logout" size={16} /> Log out
                  </button>
                </div>
              </details>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
