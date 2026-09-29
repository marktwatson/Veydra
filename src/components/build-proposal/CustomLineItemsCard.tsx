import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CustomItem {
  id: string;
  name: string;
  price: number;
  description: string;
}

interface Props {
  customItems: CustomItem[];
  setCustomItems: React.Dispatch<React.SetStateAction<CustomItem[]>>;
}

export function CustomLineItemsCard({ customItems, setCustomItems }: Props) {
  const [newItem, setNewItem] = useState({
    name: "",
    price: 0,
    description: "",
  });

  const add = () => {
    if (!newItem.name) return;
    setCustomItems([...customItems, { ...newItem, id: crypto.randomUUID() }]);
    setNewItem({ name: "", price: 0, description: "" });
  };

  const remove = (id: string) =>
    setCustomItems(customItems.filter((i) => i.id !== id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Line Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          {customItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                {item.description && (
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">
                  ${item.price.toLocaleString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(item.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Item Name</Label>
                <Input
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Travel Fee, Custom Deal"
                />
              </div>
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  value={newItem.price || ""}
                  onChange={(e) =>
                    setNewItem((p) => ({
                      ...p,
                      price: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Brief details about this item..."
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={add}
              className="w-full"
              disabled={!newItem.name}
            >
              Add Custom Item
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
