import { loadChat } from '../chatStore';
import Chat from '../components/chat';

export default async function Page(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    const messages = await loadChat(id);
    return <Chat id={id} initialMessages={messages} />;
}