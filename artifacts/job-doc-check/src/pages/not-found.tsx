import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex w-full min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="text-xl font-semibold text-foreground">페이지를 찾을 수 없습니다</h2>
        <p className="text-muted-foreground text-sm mb-4">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Link 
          href="/" 
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
