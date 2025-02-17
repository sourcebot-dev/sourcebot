'use client';

import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { Icon } from '@iconify/react';
import { languageMetadataMap } from "@/lib/languageMetadata";

interface FileIconProps {
   language: string;
}

export const FileIcon = ({ language }: FileIconProps) => {
   const iconifyName = languageMetadataMap[language]?.iconify;

   if (iconifyName) {
      return (
         <Icon icon={iconifyName} className="w-4 h-4 flex-shrink-0" />
      )
   } else {
      return (
         <QuestionMarkCircledIcon className="w-4 h-4 flex-shrink-0" />
      )
   }
};
