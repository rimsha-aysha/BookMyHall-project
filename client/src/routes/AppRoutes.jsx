import { Routes, Route } from "react-router-dom";
import { ROLES } from "../constants/roles.js";
import ProtectedRoute from "./ProtectedRoute.jsx";

import Home from "../pages/Home.jsx";
import NotFound from "../pages/NotFound.jsx";
import Login from "../pages/auth/Login.jsx";
import Register from "../pages/auth/Register.jsx";
import CustomerDashboard from "../pages/customer/CustomerDashboard.jsx";
import BookingPage from "../pages/customer/BookingPage.jsx";
import MyBookingsPage from "../pages/customer/MyBookingsPage.jsx";
import BookingDetailsPage from "../pages/customer/BookingDetailsPage.jsx";
import PaymentPage from "../pages/customer/PaymentPage.jsx";
import AccountPage from "../pages/customer/AccountPage.jsx";
import ManagerDashboard from "../pages/manager/ManagerDashboard.jsx";
import CoordinatorDashboard from "../pages/coordinator/CoordinatorDashboard.jsx";
import CoordinatorBookingDetails from "../pages/coordinator/CoordinatorBookingDetails.jsx";
import OwnerDashboard from "../pages/admin/OwnerDashboard.jsx";
import ManageManagers from "../pages/admin/ManageManagers.jsx";
import SystemSettings from "../pages/admin/SystemSettings.jsx";
import CustomerDirectory from "../pages/admin/CustomerDirectory.jsx";
import PaymentDirectory from "../pages/admin/PaymentDirectory.jsx";

import HallsPage from "../pages/customer/HallsPage.jsx";
import HallDetailsPage from "../pages/customer/HallDetailsPage.jsx";
import PackagesPage from "../pages/customer/PackagesPage.jsx";
import PackageDetailsPage from "../pages/customer/PackageDetailsPage.jsx";
import FoodPage from "../pages/customer/FoodPage.jsx";
import FoodDetailsPage from "../pages/customer/FoodDetailsPage.jsx";
import DecorationsPage from "../pages/customer/DecorationsPage.jsx";
import DecorationDetailsPage from "../pages/customer/DecorationDetailsPage.jsx";
import ServicesPage from "../pages/customer/ServicesPage.jsx";
import GalleryPage from "../pages/customer/GalleryPage.jsx";
import GalleryDetailsPage from "../pages/customer/GalleryDetailsPage.jsx";

import ManageHalls from "../pages/manager/ManageHalls.jsx";
import ManagePackages from "../pages/manager/ManagePackages.jsx";
import ManageFood from "../pages/manager/ManageFood.jsx";
import ManageDecorations from "../pages/manager/ManageDecorations.jsx";
import ManageServices from "../pages/manager/ManageServices.jsx";
import ManagerBookings from "../pages/manager/ManagerBookings.jsx";
import ManagerBookingDetails from "../pages/manager/ManagerBookingDetails.jsx";
import WalkInBooking from "../pages/manager/WalkInBooking.jsx";
import ManageGallery from "../pages/manager/ManageGallery.jsx";
import ManageCoordinators from "../pages/manager/ManageCoordinators.jsx";
import BookingCalendar from "../pages/manager/BookingCalendar.jsx";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Public catalog browsing — no login required */}
      <Route path="/halls" element={<HallsPage />} />
      <Route path="/halls/:id" element={<HallDetailsPage />} />
      <Route path="/packages" element={<PackagesPage />} />
      <Route path="/packages/:id" element={<PackageDetailsPage />} />
      <Route path="/food" element={<FoodPage />} />
      <Route path="/food/:id" element={<FoodDetailsPage />} />
      <Route path="/decorations" element={<DecorationsPage />} />
      <Route path="/decorations/:id" element={<DecorationDetailsPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/gallery/:id" element={<GalleryDetailsPage />} />

      <Route element={<ProtectedRoute allowedRoles={[ROLES.CUSTOMER]} />}>
        <Route path="/customer" element={<CustomerDashboard />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />
        <Route path="/my-bookings/:id" element={<BookingDetailsPage />} />
        <Route path="/my-bookings/:id/pay" element={<PaymentPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.MANAGER]} />}>
        <Route path="/manager" element={<ManagerDashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.COORDINATOR]} />}>
        <Route path="/coordinator" element={<CoordinatorDashboard />} />
        <Route path="/coordinator/bookings/:id" element={<CoordinatorBookingDetails />} />
        <Route path="/coordinator/calendar" element={<BookingCalendar />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={[ROLES.OWNER]} />}>
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/manage/managers" element={<ManageManagers />} />
        <Route path="/manage/settings" element={<SystemSettings />} />
        <Route path="/manage/customers" element={<CustomerDirectory />} />
        <Route path="/manage/payments" element={<PaymentDirectory />} />
      </Route>

      {/* Catalog management — Manager and Owner only */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.MANAGER, ROLES.OWNER]} />}>
        <Route path="/manage/halls" element={<ManageHalls />} />
        <Route path="/manage/packages" element={<ManagePackages />} />
        <Route path="/manage/food" element={<ManageFood />} />
        <Route path="/manage/decorations" element={<ManageDecorations />} />
        <Route path="/manage/services" element={<ManageServices />} />
        <Route path="/manage/bookings" element={<ManagerBookings />} />
        <Route path="/manage/bookings/walk-in" element={<WalkInBooking />} />
        <Route path="/manage/bookings/:id" element={<ManagerBookingDetails />} />
        <Route path="/manage/calendar" element={<BookingCalendar />} />
        <Route path="/manage/gallery" element={<ManageGallery />} />
        <Route path="/manage/coordinators" element={<ManageCoordinators />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
