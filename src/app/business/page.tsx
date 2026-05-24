"use client"

import { useRouter } from "next/navigation"

import { BusinessCenter } from "@/components/business-center"

export default function BusinessPage() {
  const router = useRouter()
  return <BusinessCenter onBack={() => router.back()} />
}
