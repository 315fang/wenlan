"use client"

import { useRouter } from "next/navigation"

import { MaterialsCenter } from "@/components/materials-center"

export default function MaterialsPage() {
  const router = useRouter()
  return <MaterialsCenter onBack={() => router.back()} />
}
