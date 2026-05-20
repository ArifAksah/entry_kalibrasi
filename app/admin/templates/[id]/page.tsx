import { redirect } from 'next/navigation'

interface TemplateEditorPageProps {
  params: Promise<{ id: string }>
}

export default async function TemplateEditorPage({ params }: TemplateEditorPageProps) {
  const { id } = await params
  redirect(`/admin/templates/${id}/word-upload`)
}
