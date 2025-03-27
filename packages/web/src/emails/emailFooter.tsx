import {
    Hr,
    Link,
    Section,
    Text,
} from '@react-email/components';

export const EmailFooter = () => {
    return (
        <Section className="mt-[10px]">
            <Hr className="border border-solid border-[#eaeaea] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
                <Link href="https://sourcebot.dev" className="underline text-[#666666]" target="_blank">
                    Sourcebot.dev,
                </Link>
                &nbsp;blazingly fast code search.
            </Text>
        </Section>
    )
}