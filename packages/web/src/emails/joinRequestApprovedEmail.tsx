import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components';
import { EmailFooter } from './emailFooter';
import { SOURCEBOT_LOGO_LIGHT_LARGE_URL, SOURCEBOT_PLACEHOLDER_AVATAR_URL } from './constants';

interface JoinRequestApprovedEmailProps {
    baseUrl: string;
    user: {
        email: string;
        name?: string;
        avatarUrl?: string;
    },
    orgName: string;
    orgDomain: string;
}

export const JoinRequestApprovedEmail = ({
    baseUrl,
    user,
    orgName,
    orgDomain,
}: JoinRequestApprovedEmailProps) => {
    const previewText = `Your request to join ${orgName} on Sourcebot has been approved`;
    const orgLink = `${baseUrl}/${orgDomain}`;

    return (
        <Html>
            <Head />
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans px-2">
                    <Preview>{previewText}</Preview>
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Section className="mt-[32px]">
                            <Img
                                src={SOURCEBOT_LOGO_LIGHT_LARGE_URL}
                                width="auto"
                                height="60"
                                alt="Sourcebot Logo"
                                className="my-0 mx-auto"
                            />
                        </Section>
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Welcome to <strong>{orgName}</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello{user.name ? ` ${user.name}` : ''},
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Your request to join <strong>{orgName}</strong> on Sourcebot has been approved. You now have access to the organization.
                        </Text>
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Button
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                                href={orgLink}
                            >
                                Go to {orgName}
                            </Button>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            or copy and paste this URL into your browser:{' '}
                            <Link href={orgLink} className="text-blue-600 no-underline">
                                {orgLink}
                            </Link>
                        </Text>
                        <EmailFooter />
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

JoinRequestApprovedEmail.PreviewProps = {
    baseUrl: 'https://sourcebot.example.com',
    user: {
        name: 'Alan Turing',
        email: 'alan.turing@example.com',
        avatarUrl: SOURCEBOT_PLACEHOLDER_AVATAR_URL,
    },
    orgName: 'Enigma',
    orgDomain: '~',
} satisfies JoinRequestApprovedEmailProps;

export default JoinRequestApprovedEmail; 