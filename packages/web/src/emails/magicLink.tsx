import {
    Body,
    Container,
    Hr,
    Img,
    Link,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components';


interface MagicLinkEmailProps {
    magicLink: string,
    baseUrl: string,
}

export const MagicLinkEmail = ({
    magicLink: url,
    baseUrl: baseUrl,
}: MagicLinkEmailProps) => (
    <Tailwind>
        <Preview>Log in to Sourcebot</Preview>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
            <Container className="my-[40px] mx-auto p-[20px] max-w-[465px]">
                <Section className="mt-[32px]">
                    <Img
                        src={`${baseUrl}/sb_logo_light_large.png`}
                        height="60"
                        width="auto"
                        alt="Sourcebot Logo"
                        className="my-0 mx-auto"
                    />
                </Section>
                <Text className="text-black text-[14px] leading-[24px]">
                    Hey there,
                </Text>
                <Text className="text-black text-[14px] leading-[24px]">
                    You can log in to your Sourcebot account by clicking the link below.
                </Text>
                <Link
                    href={url}
                    className="text-blue-600 no-underline"
                    target="_blank"
                    style={{
                        display: 'block',
                        marginBottom: '16px',
                    }}
                >
                    Click here to log in
                </Link>
                <Text className="text-black text-[14px] leading-[24px]">
                    If you didn&apos;t try to login, you can safely ignore this email.
                </Text>
                <Hr className="border border-solid border-[#eaeaea] my-[10px] mx-0 w-full" />
                <Text className="text-[#666666] text-[12px] leading-[24px]">
                    <Link href="https://sourcebot.dev" className="underline text-[#666666]" target="_blank">
                        Sourcebot.dev,
                    </Link>
                    &nbsp;blazingly fast code search.
                </Text>
            </Container>
        </Body>
    </Tailwind>
)

MagicLinkEmail.PreviewProps = {
    magicLink: 'https://example.com/login',
    baseUrl: 'http://localhost:3000',
} as MagicLinkEmailProps;

export default MagicLinkEmail;
