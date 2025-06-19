import { redirect } from 'next/navigation';
import { createChat } from './chatStore';

interface PageProps {
    params: {
        domain: string;
    }
}

export default async function Page({ params: { domain } }: PageProps) {
  const id = await createChat(); // create a new chat
  redirect(`/${domain}/chat/${id}`); // redirect to chat page, see below
}