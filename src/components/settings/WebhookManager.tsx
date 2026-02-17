import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Copy, Webhook, Settings, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/format';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret: string;
  created_at: string;
  last_triggered?: string;
  success_count: number;
  failure_count: number;
}

const EVENT_TYPES = [
  { value: 'lead.created', label: 'Lead Created' },
  { value: 'lead.updated', label: 'Lead Updated' },
  { value: 'lead.status_changed', label: 'Lead Status Changed' },
  { value: 'lead.deleted', label: 'Lead Deleted' },
  { value: 'appointment.created', label: 'Appointment Created' },
  { value: 'appointment.updated', label: 'Appointment Updated' },
  { value: 'appointment.completed', label: 'Appointment Completed' },
  { value: 'client.created', label: 'Client Created' },
  { value: 'client.updated', label: 'Client Updated' },
  { value: 'call.completed', label: 'Call Completed' },
  { value: 'sale.created', label: 'Sale Created' },
];

export function WebhookManager() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  // Create webhook
  const handleCreateWebhook = useCallback(() => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields and select at least one event',
        variant: 'destructive',
      });
      return;
    }

    const webhook: Webhook = {
      id: crypto.randomUUID(),
      name: newWebhook.name,
      url: newWebhook.url,
      events: newWebhook.events,
      is_active: true,
      secret: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      success_count: 0,
      failure_count: 0,
    };

    setWebhooks([webhook, ...webhooks]);
    setIsDialogOpen(false);
    setNewWebhook({ name: '', url: '', events: [] });

    toast({
      title: 'Success',
      description: 'Webhook created successfully',
    });
  }, [newWebhook, webhooks, toast]);

  // Toggle webhook status
  const handleToggleWebhook = useCallback((id: string, is_active: boolean) => {
    setWebhooks(webhooks.map(w =>
      w.id === id ? { ...w, is_active: !is_active } : w
    ));

    toast({
      title: 'Success',
      description: `Webhook ${!is_active ? 'enabled' : 'disabled'}`,
    });
  }, [webhooks, toast]);

  // Delete webhook
  const handleDeleteWebhook = useCallback((id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    setWebhooks(webhooks.filter(w => w.id !== id));

    toast({
      title: 'Success',
      description: 'Webhook deleted successfully',
    });
  }, [webhooks, toast]);

  // Copy webhook URL
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'URL copied to clipboard',
    });
  }, [toast]);

  // Simulate test webhook
  const handleTestWebhook = useCallback((webhook: Webhook) => {
    toast({
      title: 'Test Sent',
      description: `Test payload sent to ${webhook.url}`,
    });

    // Simulate success
    setWebhooks(webhooks.map(w =>
      w.id === webhook.id
        ? { ...w, last_triggered: new Date().toISOString(), success_count: w.success_count + 1 }
        : w
    ));
  }, [webhooks, toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Webhook Management</h2>
          <p className="text-muted-foreground">Configure webhooks to integrate with external services</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Webhook Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Slack Notifications"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://your-server.com/webhook"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Trigger Events</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {EVENT_TYPES.map((event) => (
                    <label
                      key={event.value}
                      className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewWebhook({
                              ...newWebhook,
                              events: [...newWebhook.events, event.value],
                            });
                          } else {
                            setNewWebhook({
                              ...newWebhook,
                              events: newWebhook.events.filter((e) => e !== event.value),
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateWebhook}>
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active ({webhooks.filter(w => w.is_active).length})</TabsTrigger>
          <TabsTrigger value="all">All Webhooks ({webhooks.length})</TabsTrigger>
          <TabsTrigger value="logs">Recent Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {webhooks.filter(w => w.is_active).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Webhooks</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first webhook to start receiving event notifications
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {webhooks.filter(w => w.is_active).map((webhook) => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  onToggle={handleToggleWebhook}
                  onDelete={handleDeleteWebhook}
                  onCopy={copyToClipboard}
                  onTest={handleTestWebhook}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4">
            {webhooks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Webhooks Configured</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first webhook to start integrating with external services
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Webhook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              webhooks.map((webhook) => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  onToggle={handleToggleWebhook}
                  onDelete={handleDeleteWebhook}
                  onCopy={copyToClipboard}
                  onTest={handleTestWebhook}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Webhook Activity</CardTitle>
              <CardDescription>View recent webhook delivery attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Webhook delivery logs will appear here</p>
                  <p className="text-sm mt-2">This feature requires a database backend</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface WebhookCardProps {
  webhook: Webhook;
  onToggle: (id: string, is_active: boolean) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
  onTest: (webhook: Webhook) => void;
}

function WebhookCard({ webhook, onToggle, onDelete, onCopy, onTest }: WebhookCardProps) {
  const webhookUrl = `${window.location.origin}/api/webhooks/${webhook.id}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${webhook.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Webhook className={`h-5 w-5 ${webhook.is_active ? 'text-green-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <CardTitle className="text-base">{webhook.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <code className="text-xs bg-muted px-1 py-0.5 rounded max-w-[200px] truncate">
                  {webhook.url}
                </code>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={webhook.is_active}
              onCheckedChange={() => onToggle(webhook.id, webhook.is_active)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1 mb-4">
          {webhook.events.map((event) => (
            <Badge key={event} variant="secondary" className="text-xs">
              {event}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              {webhook.success_count} success
            </span>
            {webhook.failure_count > 0 && (
              <span className="text-red-500">
                {webhook.failure_count} failed
              </span>
            )}
            {webhook.last_triggered && (
              <span>
                Last: {formatDateTime(webhook.last_triggered)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(webhook)}
            >
              Test
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopy(webhookUrl)}
              title="Copy webhook URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(webhook.id)}
              title="Delete webhook"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
