import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Link, useLocation } from "wouter"
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react"

import { Button } from "@/components/ui/button"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { BrainCircuit } from "lucide-react"

const loginSchema = z.object({
  email:    z.string().email({ message: "올바른 이메일을 입력해주세요" }),
  password: z.string().min(1, { message: "비밀번호를 입력해주세요" }),
})

export default function LoginPage() {
  const [, navigate] = useLocation()
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } })
  const login = useLogin()

  // 이미 로그인 상태면 대시보드로 — 렌더 중 navigate 금지, useEffect 안에서만
  useEffect(() => {
    if (user) navigate("/dashboard")
  }, [user]) // navigate 는 wouter stable ref → 의존성 불필요

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  function onSubmit(values: z.infer<typeof loginSchema>) {
    login.mutate({ data: values }, {
      onSuccess: () => navigate("/dashboard"),
      onError: (err) => {
        form.setError("root", {
          message: (err as any)?.data?.error || "로그인에 실패했습니다",
        })
      },
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <BrainCircuit className="w-12 h-12 text-primary" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
          로그인
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          또는{" "}
          <Link href="/register" className="font-medium text-primary hover:text-primary/90">
            회원가입
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {form.formState.errors.root && (
                  <div className="p-3 rounded bg-destructive/10 text-destructive text-sm font-medium">
                    {form.formState.errors.root.message}
                  </div>
                )}

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full" disabled={login.isPending}>
                  {login.isPending ? "로그인 중…" : "로그인"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
