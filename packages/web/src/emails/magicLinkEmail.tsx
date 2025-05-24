import {
    Body,
    Container,
    Head,
    Html,
    Img,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components';
import { SOURCEBOT_LOGO_LIGHT_LARGE_URL } from './constants';

interface MagicLinkEmailProps {
    token: string,
}

export const MagicLinkEmail = ({
    token,
}: MagicLinkEmailProps) => (
    <Html>
        <Head />
        <Preview>Use this code {token} to log in to Sourcebot</Preview>
        <Tailwind>
            <Body className="bg-white font-sans m-0 p-0">
                <Container className="mx-auto max-w-[600px] p-6">
                    <Section className="mb-4">
                        <Img
                            src={SOURCEBOT_LOGO_LIGHT_LARGE_URL}
                            alt="Sourcebot Logo"
                            width="auto"
                            height="40"
                            className="mx-0"
                        />
                    </Section>

                    <Section className="mb-4">
                        <Text className="text-base text-black">
                            Use the code below to log in to Sourcebot.
                        </Text>
                    </Section>

                    <Section className="bg-[#f4f7fa] py-4 px-2 rounded mb-4 text-center">
                        <Text className="text-xl font-bold text-black tracking-[0.5em]">
                            {token}
                        </Text>
                    </Section>

                    <Section>
                        <Text className="text-sm text-gray-600 leading-6">
                            This code is only valid for the next 10 minutes. If you didn&apos;t try to log in,
                            you can safely ignore this email.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Tailwind>
    </Html>
);

MagicLinkEmail.PreviewProps = {
    token: '123456',
} as MagicLinkEmailProps;

export default MagicLinkEmail;
