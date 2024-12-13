'use client';

import { getFileIconSvg } from "./fileIconSvg";
import { getFileIconIconify } from "./fileIconIconify"
import Image from "next/image";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { Icon } from '@iconify/react';

interface FileIconProps {
   language: string;
}

export const FileIcon = ({ language }: FileIconProps) => {
   const iconSvg = getFileIconSvg(language);
   let iconifyName = null;
   if (!iconSvg) {
      iconifyName = getFileIconIconify(language);
   }

   if (iconSvg) {
      return (
         <Image
            src={iconSvg}
            alt={language}
            className="w-4 h-4 flex-shrink-0"
         />
      )
   } else if (iconifyName) {
      return (
         <Icon icon={iconifyName} className="w-4 h-4 flex-shrink-0" />
      )
   } else {
      return (
         <QuestionMarkCircledIcon className="w-4 h-4 flex-shrink-0" />
      )
   }
};
