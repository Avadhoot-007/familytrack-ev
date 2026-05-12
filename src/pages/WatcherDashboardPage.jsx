// WatcherDashboardPage: Wrapper for WatcherDashboard (for routing)
import WatcherDashboard from "../components/WatcherDashboard";

export default function WatcherDashboardPage({ sentTipsRef }) {
  return <WatcherDashboard sentTipsRef={sentTipsRef} />;
}
