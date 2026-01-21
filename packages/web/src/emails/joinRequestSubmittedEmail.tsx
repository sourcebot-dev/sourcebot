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
import { SOURCEBOT_LOGO_LIGHT_LARGE_URL, SOURCEBOT_ARROW_IMAGE_URL, SOURCEBOT_PLACEHOLDER_AVATAR_URL } from './constants';

interface JoinRequestSubmittedEmailProps {
    baseUrl: string;
    requestor: {
        email: string;
        name?: string;
        avatarUrl?: string;
    },
    orgName: string;
    orgDomain: string;
    orgImageUrl?: string;
}

export const JoinRequestSubmittedEmail = ({
    baseUrl,
    requestor,
    orgName,
    orgDomain,
    orgImageUrl,
}: JoinRequestSubmittedEmailProps) => {
    const previewText = `${requestor.name ?? requestor.email} has requested to join ${orgName} on Sourcebot`;
    const reviewLink = `${baseUrl}/${encodeURIComponent(orgDomain)}/settings/members`;

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
                            New Join Request for <strong>{orgName}</strong>
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hello,
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <RequestorInfo email={requestor.email} name={requestor.name} /> has requested to join your organization <strong>{orgName}</strong> on Sourcebot.
                        </Text>
                        <Section>
                            <Row>
                                <Column align="right">
                                    <Img
                                        className="rounded-full"
                                        src={requestor.avatarUrl ? requestor.avatarUrl : SOURCEBOT_PLACEHOLDER_AVATAR_URL}
                                        width="64"
                                        height="64"
                                        alt="Requestor avatar"
                                    />
                                </Column>
                                <Column align="center">
                                    <Img
                                        src={SOURCEBOT_ARROW_IMAGE_URL}
                                        width="12"
                                        height="9"
                                        alt="requesting to join"
                                    />
                                </Column>
                                <Column align="left">
                                    <Img
                                        className="rounded-full"
                                        src={orgImageUrl ? orgImageUrl : SOURCEBOT_PLACEHOLDER_AVATAR_URL}
                                        width="64"
                                        height="64"
                                        alt="Organization avatar"
                                    />
                                </Column>
                            </Row>
                        </Section>
                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Button
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                                href={reviewLink}
                            >
                                Review join request
                            </Button>
                        </Section>
                        <Text className="text-black text-[14px] leading-[24px]">
                            or copy and paste this URL into your browser:{' '}
                            <Link href={reviewLink} className="text-blue-600 no-underline">
                                {reviewLink}
                            </Link>
                        </Text>
                        <EmailFooter />
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

const RequestorInfo = ({ email, name }: { email: string, name?: string }) => {
    const emailElement = <Link href={`mailto:${email}`} className="text-blue-600 no-underline">{email}</Link>;

    if (name) {
        return <span><strong>{name}</strong> ({emailElement})</span>;
    }

    return emailElement;
}

JoinRequestSubmittedEmail.PreviewProps = {
    baseUrl: 'https://example.sourcebot.dev',
    requestor: {
        name: 'Alan Turing',
        email: 'alan.turing@example.com',
        avatarUrl: SOURCEBOT_PLACEHOLDER_AVATAR_URL,
    },
    orgName: 'Enigma',
    orgDomain: '~',
    orgImageUrl: SOURCEBOT_PLACEHOLDER_AVATAR_URL,
} satisfies JoinRequestSubmittedEmailProps;

export default JoinRequestSubmittedEmail;
