import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, Package, Clock, Globe, CheckCircle, Plus, Trash2, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { SiDiscord } from "react-icons/si";

interface BotStatus {
  status: string;
  botConnected: boolean;
  botUsername: string | null;
  trackedItemsCount: number;
  region: string;
  checkIntervalMs: number;
}

interface TrackedItem {
  id: number;
  sid: number;
  name: string;
  lastPrice: number;
  lastStock: number;
  lastSoldTime: number;
  addedAt: number;
}

function formatSilver(amount: number): string {
  return amount.toLocaleString("en-US");
}

function formatRelativeTime(epochSeconds: number): string {
  if (!epochSeconds || epochSeconds === 0) {
    return "Never";
  }
  
  const now = Math.floor(Date.now() / 1000);
  const diff = now - epochSeconds;
  
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getEnhancementLabel(sid: number): string {
  if (sid === 0) return "";
  if (sid <= 15) return ` (+${sid})`;
  const labels: { [key: number]: string } = { 16: " (PRI)", 17: " (DUO)", 18: " (TRI)", 19: " (TET)", 20: " (PEN)" };
  return labels[sid] || ` (+${sid})`;
}

export default function Home() {
  const { toast } = useToast();
  const [itemId, setItemId] = useState("");
  const [subId, setSubId] = useState("0");

  const { data: status, isLoading: statusLoading } = useQuery<BotStatus>({
    queryKey: ["/api/status"],
    refetchInterval: 10000,
  });

  const { data: items, isLoading: itemsLoading } = useQuery<TrackedItem[]>({
    queryKey: ["/api/items"],
    refetchInterval: 30000,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { id: number; sid: number }) => {
      return apiRequest("POST", "/api/items", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
      setItemId("");
      setSubId("0");
      toast({
        title: "Item Added",
        description: "The item has been added to your watchlist.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add item. Check the ID and try again.",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (data: { id: number; sid: number }) => {
      return apiRequest("DELETE", `/api/items/${data.id}?sid=${data.sid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/status"] });
      toast({
        title: "Item Removed",
        description: "The item has been removed from your watchlist.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item.",
        variant: "destructive",
      });
    },
  });

  const checkPricesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/check-prices");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Prices Checked",
        description: "All item prices have been refreshed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to check prices.",
        variant: "destructive",
      });
    },
  });

  const testAlertMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/test-alert");
    },
    onSuccess: () => {
      toast({
        title: "Test Alert Sent",
        description: "Check your Discord #market-alerts channel for the test message.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test alert. Make sure DISCORD_WEBHOOK_URL is set.",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(itemId, 10);
    const sid = parseInt(subId, 10);
    
    if (isNaN(id) || id <= 0) {
      toast({
        title: "Invalid Item ID",
        description: "Please enter a valid item ID number.",
        variant: "destructive",
      });
      return;
    }
    
    addItemMutation.mutate({ id, sid: isNaN(sid) ? 0 : sid });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-md bg-[#5865F2]">
            <SiDiscord className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">BDO Market Bot</h1>
            <p className="text-muted-foreground">Black Desert Online Marketplace Price Tracker</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Price Monitor</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-semibold text-foreground">Active</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Webhook alerts enabled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tracked Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{status?.trackedItemsCount || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Check Interval</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold text-foreground">
                  {Math.floor((status?.checkIntervalMs || 300000) / 60000)} min
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Region</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold text-foreground uppercase">{status?.region || "EU"}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Item to Track
            </CardTitle>
            <CardDescription>
              Enter the item ID from the BDO marketplace. You can find item IDs on{" "}
              <a 
                href="https://bdocodex.com/us/items/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                BDOCodex
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddItem} className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[150px]">
                <Label htmlFor="itemId">Item ID</Label>
                <Input
                  id="itemId"
                  type="number"
                  placeholder="e.g. 10007"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  data-testid="input-item-id"
                />
              </div>
              <div className="w-24">
                <Label htmlFor="subId">Enhancement</Label>
                <Input
                  id="subId"
                  type="number"
                  placeholder="0"
                  value={subId}
                  onChange={(e) => setSubId(e.target.value)}
                  data-testid="input-sub-id"
                />
              </div>
              <Button 
                type="submit" 
                disabled={addItemMutation.isPending}
                data-testid="button-add-item"
              >
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              Enhancement levels: 0 = Base, 1-15 = +1 to +15, 16 = PRI, 17 = DUO, 18 = TRI, 19 = TET, 20 = PEN
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Tracked Items
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkPricesMutation.mutate()}
              disabled={checkPricesMutation.isPending || !items?.length}
              data-testid="button-refresh-prices"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checkPricesMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Prices
            </Button>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : items && items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={`${item.id}-${item.sid}`}
                    className="flex items-center justify-between p-4 rounded-md bg-muted/50 border border-border"
                    data-testid={`item-row-${item.id}-${item.sid}`}
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={`https://s1.pearlcdn.com/NAEU/TradeMarket/Common/img/BDO/item/${item.id}.png`}
                        alt={item.name}
                        className="w-12 h-12 rounded-md bg-background"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/favicon.png";
                        }}
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {item.name}{getEnhancementLabel(item.sid)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ID: {item.id}, SID: {item.sid}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{formatSilver(item.lastPrice)} Silver</p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <Badge variant="secondary" className="text-xs">
                            Stock: {item.lastStock}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(item.lastSoldTime)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItemMutation.mutate({ id: item.id, sid: item.sid })}
                        disabled={removeItemMutation.isPending}
                        data-testid={`button-remove-${item.id}-${item.sid}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No items being tracked</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Use the form above to add items to your watchlist
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Test Discord Connection
            </CardTitle>
            <CardDescription>
              Send a test alert to verify your webhook is connected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => testAlertMutation.mutate()}
              disabled={testAlertMutation.isPending}
              data-testid="button-test-alert"
            >
              {testAlertMutation.isPending ? "Sending..." : "Send Test Alert"}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Click above to send a sample price alert to your #market-alerts channel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-md bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <h3 className="font-semibold text-foreground">Add Items</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter item IDs from BDOCodex to start tracking prices.
                </p>
              </div>
              <div className="p-4 rounded-md bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <h3 className="font-semibold text-foreground">Monitor</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Prices are checked every 5 minutes automatically.
                </p>
              </div>
              <div className="p-4 rounded-md bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <h3 className="font-semibold text-foreground">Get Alerts</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receive Discord alerts when prices change.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
