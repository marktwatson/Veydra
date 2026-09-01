import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
// HMR force reload comment
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";

import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { DEFAULT_LOGO_URL } from "@/lib/utils";

import Dashboard from "@/pages/Dashboard";
import Opportunities from "@/pages/Opportunities";
import OpportunityDetail from "@/pages/OpportunityDetail";
import Assignments from "@/pages/Assignments";
import AssignmentDetail from "@/pages/AssignmentDetail";
import Invoices from "@/pages/Invoices";
import Notifications from "@/pages/Notifications";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import SetupPassword from "@/pages/SetupPassword";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import BridePortal from "@/pages/BridePortal";
import ClientFeedback from "@/pages/ClientFeedback";
import Book from "@/pages/Book";
import GiftWedding from "@/pages/GiftWedding";
import ProposalReview from "@/pages/ProposalReview";
import PaymentPlanApproval from "@/pages/PaymentPlanApproval";

import ManagerDashboard from "@/pages/manager/Dashboard";
import ManagerWeddings from "@/pages/manager/Weddings";
import CreateProposal from "@/pages/manager/CreateProposal";
import ManagerProposals from "@/pages/manager/Proposals";
import ManagerPositions from "@/pages/manager/Positions";
import ManagerApplications from "@/pages/manager/Applications";
import ManagerAssignments from "@/pages/manager/Assignments";
import ManagerContractors from "@/pages/manager/Contractors";
import ManagerTeam from "@/pages/manager/Team";
import ManagerMessages from "@/pages/manager/Messages";
import ManagerSettings from "@/pages/manager/Settings";
import ManagerActivityLog from "@/pages/manager/ActivityLog";
import ManagerChangelog from "@/pages/manager/Changelog";
import ManagerProfile from "@/pages/manager/Profile";
import ManagerPayouts from "@/pages/manager/Payouts";
import ManagerTaxes from "@/pages/manager/Taxes";
import ManagerPaymentAudit from "@/pages/manager/PaymentAudit";
import ManagerAccounting from "@/pages/manager/Accounting";
import ManagerLeads from "@/pages/manager/Leads";
import ManagerAdCampaigns from "@/pages/manager/AdCampaigns";
import GrowthHub from "@/pages/manager/GrowthHub";
import ExportProject from "@/pages/manager/ExportProject";
import Territories from "@/pages/manager/Territories";
import PostProductionBoard from "@/pages/manager/PostProduction";
import EditorDashboard from "@/pages/editor/Dashboard";
import EditorInvoices from "@/pages/editor/Invoices";
import Training from "@/pages/Training";
import Apply from "@/pages/Apply";
import RoyaltyWithSync from "@/components/RoyaltyWithSync";
import OwnerRoyaltyWithSync from "@/components/OwnerRoyaltyWithSync";
import StripePayoutSetup from "@/pages/manager/StripePayoutSetup";

const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
    <div className="relative flex items-center justify-center mb-6">
      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping"></div>
      <img
        src={DEFAULT_LOGO_URL}
        alt="Loading..."
        className="w-24 h-auto object-contain animate-pulse relative z-10"
        onError={(e) => {
          (e.target as HTMLImageElement).src = DEFAULT_LOGO_URL;
        }}
      />
    </div>
  </div>
);

const ProtectedRoute = ({
  children,
  requireRole,
  restrictRoles,
  superAdminOnly,
}: {
  children: React.ReactNode;
  requireRole?:
    | "super_admin"
    | "owner"
    | "owner_readonly"
    | "manager"
    | "contractor"
    | "editor";
  restrictRoles?: UserRole[];
  superAdminOnly?: boolean;
}) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (window.location.hash.includes("type=recovery")) {
    return <Navigate to={`/reset-password${window.location.hash}`} replace />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (superAdminOnly && user.role !== "super_admin") {
    return <Navigate to="/manager" replace />;
  }

  if (restrictRoles && restrictRoles.includes(user.role)) {
    return <Navigate to="/manager" replace />;
  }

  if (requireRole && user.role !== requireRole) {
    // Manager routes are accessible by super_admin, owner, owner_readonly, and manager
    if (
      requireRole === "manager" &&
      ["super_admin", "owner", "owner_readonly", "manager"].includes(user.role)
    ) {
      return <Layout>{children}</Layout>;
    }

    // Owner routes are also accessible by owner_readonly (view-only)
    if (requireRole === "owner" && user.role === "owner_readonly") {
      return <Layout>{children}</Layout>;
    }

    if (
      ["super_admin", "owner", "owner_readonly", "manager"].includes(user.role)
    )
      return <Navigate to="/manager" replace />;
    if (user.role === "editor") return <Navigate to="/editor" replace />;
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Initialize query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1 * 60 * 1000, // 1 minute
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: 1,
    },
  },
});

const Mgr = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="manager">{children}</ProtectedRoute>
);
const MgrOwner = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="manager" restrictRoles={["manager"]}>
    {children}
  </ProtectedRoute>
);

const App = () => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="veydra-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/setup-password" element={<SetupPassword />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/apply" element={<Apply />} />
                <Route path="/book" element={<Book />} />
                <Route path="/bride-portal/:id" element={<BridePortal />} />
                <Route path="/gift/:id" element={<GiftWedding />} />
                <Route path="/feedback/:id" element={<ClientFeedback />} />
                <Route path="/build-proposal" element={<CreateProposal />} />
                <Route path="/edit-proposal/:id" element={<CreateProposal />} />
                <Route path="/proposal/:id" element={<ProposalReview />} />
                <Route
                  path="/payment-plan/:token"
                  element={<PaymentPlanApproval />}
                />

                {/* Contractor Routes */}
                <Route
                  path="/training"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <Training />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/opportunities"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <Opportunities />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/opportunities/:id"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <OpportunityDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assignments"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <Assignments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assignments/:id"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <AssignmentDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <Invoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <Messages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute requireRole="contractor">
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                {/* Manager Routes */}
                <Route
                  path="/manager"
                  element={
                    <Mgr>
                      <ManagerDashboard />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/weddings"
                  element={
                    <Mgr>
                      <ManagerWeddings />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/proposals"
                  element={
                    <Mgr>
                      <ManagerProposals />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/positions"
                  element={
                    <Mgr>
                      <ManagerPositions />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/applications"
                  element={
                    <Mgr>
                      <ManagerApplications />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/assignments"
                  element={
                    <Mgr>
                      <ManagerAssignments />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/payouts"
                  element={
                    <Mgr>
                      <ManagerPayouts />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/taxes"
                  element={
                    <Mgr>
                      <ManagerTaxes />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/payments"
                  element={
                    <Mgr>
                      <ManagerPaymentAudit />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/accounting"
                  element={
                    <MgrOwner>
                      <ManagerAccounting />
                    </MgrOwner>
                  }
                />
                <Route
                  path="/manager/post-production"
                  element={
                    <Mgr>
                      <PostProductionBoard />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/contractors"
                  element={
                    <Mgr>
                      <ManagerContractors />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/team"
                  element={
                    <MgrOwner>
                      <ManagerTeam />
                    </MgrOwner>
                  }
                />
                <Route
                  path="/manager/messages"
                  element={
                    <Mgr>
                      <ManagerMessages />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/profile"
                  element={
                    <Mgr>
                      <ManagerProfile />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/growth"
                  element={
                    <Mgr>
                      <GrowthHub />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/settings"
                  element={
                    <Mgr>
                      <ManagerSettings />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/leads"
                  element={
                    <MgrOwner>
                      <ManagerLeads />
                    </MgrOwner>
                  }
                />
                <Route
                  path="/manager/ad-campaigns"
                  element={
                    <MgrOwner>
                      <ManagerAdCampaigns />
                    </MgrOwner>
                  }
                />
                <Route
                  path="/manager/export"
                  element={
                    <Mgr>
                      <ExportProject />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/territories"
                  element={
                    <MgrOwner>
                      <Territories />
                    </MgrOwner>
                  }
                />
                <Route
                  path="/manager/royalty"
                  element={
                    <ProtectedRoute requireRole="manager" superAdminOnly>
                      <RoyaltyWithSync />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/manager/stripe-payout"
                  element={
                    <ProtectedRoute requireRole="manager" superAdminOnly>
                      <StripePayoutSetup />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/manager/activity"
                  element={
                    <Mgr>
                      <ManagerActivityLog />
                    </Mgr>
                  }
                />
                <Route
                  path="/manager/changelog"
                  element={
                    <Mgr>
                      <ManagerChangelog />
                    </Mgr>
                  }
                />

                {/* Owner Routes */}
                <Route
                  path="/owner/royalty"
                  element={
                    <ProtectedRoute requireRole="owner">
                      <OwnerRoyaltyWithSync />
                    </ProtectedRoute>
                  }
                />

                {/* Editor Routes */}
                <Route
                  path="/editor"
                  element={
                    <ProtectedRoute requireRole="editor">
                      <EditorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/editor/invoices"
                  element={
                    <ProtectedRoute requireRole="editor">
                      <EditorInvoices />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
