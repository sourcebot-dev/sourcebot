import {
    Body,
    Button,
    Column,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Row,
    Section,
    Tailwind,
    Text,
} from '@react-email/components';
import { EmailFooter } from './emailFooter';
interface InviteUserEmailProps {
    inviteLink: string;
    baseUrl: string;
    host: {
        email: string;
        name?: string;
        avatarUrl?: string;
    },
    recipient: {
        name?: string;
    },
    orgName: string;
    orgImageUrl?: string;
}

export const InviteUserEmail = ({
    baseUrl,
    host,
    recipient,
    orgName,
    orgImageUrl,
    inviteLink,
}: InviteUserEmailProps) => {
    const previewText = `Join ${host.name ?? host.email} on Sourcebot`;

    return (
        <Html>
            <Head />
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans px-2">
                    <Preview>{previewText}</Preview>
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Section className="mt-[32px]">
                            <Img
                                src={`${baseUrl}/sb_logo_light_large.png`}
                                width="auto"
                                height="60"
                                alt="Sourcebot Logo"
                                className="my-0 mx-auto"
                            />
                        </Section>
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Join <strong>{orgName}</strong> on <strong>Sourcebot</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            {`Hello${recipient.name ? ` ${recipient.name.split(' ')[0]}` : ''},`}
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <InvitedByText email={host.email} name={host.name} /> has invited you to the <strong>{orgName}</strong> organization on{' '}
                            <strong>Sourcebot</strong>.
                        </Text>
                        <Section>
                            <Row>
                                <Column align="right">
                                    <Img
                                        className="rounded-full"
                                        src={host.avatarUrl ? host.avatarUrl : `${baseUrl}/placeholder_avatar.png`}
                                        width="64"
                                        height="64"
                                    />
                                </Column>
                                <Column align="center">
                                    <Img
                                        src={`${baseUrl}/arrow.png`}
                                        width="12"
                                        height="9"
                                        alt="invited you to"
                                    />
                                </Column>
                                <Column align="left">
                                    <Img
                                        className="rounded-full"
                                        src={orgImageUrl ? orgImageUrl : `${baseUrl}/placeholder_avatar.png`}
                                        width="64"
                                        height="64"
                                    />
                                </Column>
                            </Row>
                        </Section>
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Button
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                                href={inviteLink}
                            >
                                Join the organization
                            </Button>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            or copy and paste this URL into your browser:{' '}
                            <Link href={inviteLink} className="text-blue-600 no-underline">
                                {inviteLink}
                            </Link>
                        </Text>
                        <EmailFooter />
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

const InvitedByText = ({ email, name }: { email: string, name?: string }) => {
    const emailElement = <Link href={`mailto:${email}`} className="text-blue-600 no-underline">{email}</Link>;

    if (name) {
        const firstName = name.split(' ')[0];
        return <span><strong>{firstName}</strong> ({emailElement})</span>;
    }

    return emailElement;
}

InviteUserEmail.PreviewProps = {
    baseUrl: 'http://localhost:3000',
    host: {
        name: 'Alan Turing',
        email: 'alan.turing@example.com',
        // avatarUrl: `http://localhost:3000/arrow.png`,
    },
    recipient: {
        // name: 'alanturing',
    },
    orgName: 'Enigma',
    orgImageUrl: `http://localhost:3000/arrow.png`,
    inviteLink: 'https://localhost:3000/redeem?invite_id=1234',
} satisfies InviteUserEmailProps;

export default InviteUserEmail;