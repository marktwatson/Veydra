import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  const handleReturn = () => {
    if (user?.role === "manager" || user?.role === "super_admin") {
      navigate("/manager");
    } else if (user?.role === "editor") {
      navigate("/editor");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <div>
          <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-sm">
              {location.pathname}
            </code>{" "}
            does not exist.
          </p>
        </div>
        <Button onClick={handleReturn} size="lg" className="w-full sm:w-auto">
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
