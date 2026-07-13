import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">本心 Tathata — 設計系統預覽</h1>
        <p className="text-sm text-muted-foreground">
          切換下方主題，確認 4 套 destiny.tathata.live 品牌 token 都能正確套用。
        </p>
        <ThemeSwitcher />
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>能量檔案</CardTitle>
          <CardDescription>命盤快取與多系統排盘結果的展示卡片範例</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge>八字</Badge>
            <Badge variant="secondary">紫微</Badge>
            <Badge variant="outline">星盤</Badge>
            <Badge variant="destructive">尚未生成</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>主要按鈕</Button>
            <Button variant="secondary">次要按鈕</Button>
            <Button variant="outline">外框按鈕</Button>
            <Button variant="ghost">幽靈按鈕</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
