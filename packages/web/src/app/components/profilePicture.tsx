import { auth } from "@/auth"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
  } from "@/components/ui/avatar"
   
export const ProfilePicture = async () => {
    const session = await auth()

    return (
      <Avatar>
        <AvatarImage
            src={session?.user?.image ?? ""}
            alt="@shadcn"
        />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    )
  }