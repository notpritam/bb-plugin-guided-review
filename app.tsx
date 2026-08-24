// bb-plugin-guided-review — frontend entry.
//
// Placeholder homepage card until Task 13 registers the "Guided Review"
// navPanel. Kept minimal so the bundle builds while the backend takes shape.
import { definePluginApp, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StatusCard() {
  const rpc = useRpc<typeof rpcContract>();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guided Review</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void rpc.call("ping", null)}
        >
          Check backend
        </Button>
      </CardContent>
    </Card>
  );
}

export default definePluginApp((app) => {
  app.slots.homepageSection({
    id: "guided-review-status",
    title: "Guided Review",
    component: StatusCard,
  });
});
