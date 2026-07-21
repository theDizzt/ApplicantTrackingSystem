import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Link, useLocation } from "wouter"
import { useRegister, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { BrainCircuit } from "lucide-react"

const registerSchema = z.object({
  name: z.string().min(2, { message: "이름을 입력해주세요" }),
  email: z.string().email({ message: "올바른 이메일을 입력해주세요" }),
  password: z.string().min(6, { message: "비밀번호는 최소 6자 이상이어야 합니다" }),
})

export default function RegisterPage() {
  const [, setLocation] = useLocation()
  const { data: user, isSuccess } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } })
  const register = useRegister()

  // isSuccess 가드: 서버에서 실제로 인증이 확인된 경우에만 이동
  // (stale 캐시만 있을 때 user가 truthy가 되어 redirect 되는 것을 방지)
  useEffect(() => {
    if (isSuccess && user) setLocation("/dashboard")
  }, [isSuccess, user, setLocation])

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  function onSubmit(values: z.infer<typeof registerSchema>) {
    register.mutate(
      { data: values },
      {
        onSuccess: () => {
          setLocation("/dashboard")
        },
        onError: (err) => {
          form.setError("root", { message: (err as any)?.data?.error || "회원가입에 실패했습니다" })
        }
      }
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <BrainCircuit className="w-12 h-12 text-primary" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
          회원가입
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary/90">
            로그인
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

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름</FormLabel>
                      <FormControl>
                        <Input placeholder="홍길동" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={register.isPending}>
                  {register.isPending ? "가입 중..." : "회원가입"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
