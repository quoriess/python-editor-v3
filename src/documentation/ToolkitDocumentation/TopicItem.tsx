/**
 * (c) 2021, Micro:bit Educational Foundation and contributors
 *
 * SPDX-License-Identifier: MIT
 */
import { Button } from "@chakra-ui/button";
import { Box, BoxProps, Flex, HStack, Stack, Text } from "@chakra-ui/layout";
import { Portal } from "@chakra-ui/portal";
import { Select } from "@chakra-ui/select";
import { forwardRef } from "@chakra-ui/system";
import {
  ChangeEvent,
  Ref,
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSplitViewContext } from "../../common/SplitView/context";
import { useActiveEditorActions } from "../../editor/active-editor-hooks";
import { useScrollablePanelAncestor } from "../../workbench/ScrollablePanel";
import { ToolkitCode, ToolkitTopic, ToolkitTopicItem } from "./model";
import MoreButton from "./MoreButton";

interface TopicItemProps extends BoxProps {
  topic: ToolkitTopic;
  item: ToolkitTopicItem;
  detail?: boolean;
  onForward: () => void;
}

/**
 * A toolkit topic item. Can be displayed without detail (for the listing)
 * or with detail for the "More info" view.
 *
 * We show a pop-up over the code on hover to reveal the full code, overlapping
 * the sidebar scroll area.
 */
const TopicItem = ({
  topic,
  item,
  detail,
  onForward,

  ...props
}: TopicItemProps) => {
  const contents = detail
    ? item.contents
    : item.contents.filter((x) => !x.detail);
  return (
    <Stack spacing={detail ? 5 : 3} {...props} fontSize={detail ? "md" : "sm"}>
      {!detail && (
        <Text as="h3" fontSize="lg" fontWeight="semibold">
          {item.name}
        </Text>
      )}
      {contents.map((block, index) => {
        // CMS will have _key here.
        // We can also support paragraphs, formatting etc. properly.
        switch (block._type) {
          case "code":
            return (
              <CodeTemplate
                key={index}
                toolkitCode={block}
                detail={detail}
                hasDetail={contents.length !== item.contents.length}
                onForward={onForward}
              />
            );
          case "text":
            return <Text key={index}>{block.value}</Text>;
          default:
            throw new Error();
        }
      })}
    </Stack>
  );
};

interface CodeTemplateProps {
  toolkitCode: ToolkitCode;
  detail?: boolean;
  hasDetail?: boolean;
  onForward: () => void;
}

const CodeTemplate = ({
  detail,
  hasDetail,
  onForward,
  toolkitCode,
}: CodeTemplateProps) => {
  const actions = useActiveEditorActions();
  const [hovering, setHovering] = useState(false);
  const [option, setOption] = useState<string | undefined>(
    toolkitCode.select?.options[0]
  );
  const handleSelectChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      setOption(e.currentTarget.value);
    },
    [setOption]
  );
  const templatedCode = templateCode(toolkitCode, option);
  // Strip the imports.
  const code = templatedCode.replace(/^\s*(from[ ]|import[ ]).*$/gm, "").trim();
  const codeRef = useRef<HTMLDivElement>(null);
  const lines = code.trim().split("\n").length;
  const textHeight = lines * 1.5 + "em";
  const codeHeight = `calc(${textHeight} + var(--chakra-space-5) + var(--chakra-space-5))`;

  return (
    <>
      {toolkitCode.select && (
        <Flex wrap="wrap" as="label">
          <Text alignSelf="center" mr={2} as="span">
            {toolkitCode.select.prompt}
          </Text>
          <Select
            w="fit-content"
            onChange={handleSelectChange}
            value={option}
            size="sm"
          >
            {toolkitCode.select.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Flex>
      )}
      <Box>
        <Box height={codeHeight} fontSize="md">
          <Code
            // Shadow only on this one, not the pop-up.
            boxShadow="rgba(0, 0, 0, 0.18) 0px 2px 6px;"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            value={code}
            position="absolute"
            ref={codeRef}
          />
          {hovering && (
            <CodePopUp
              setHovering={setHovering}
              value={code}
              codeRef={codeRef}
            />
          )}
        </Box>
        <HStack spacing={3}>
          <Button
            fontWeight="normal"
            color="white"
            borderColor="rgb(141, 141, 143)"
            bgColor="rgb(141, 141, 143)"
            borderTopRadius="0"
            borderBottomRadius="xl"
            variant="ghost"
            size="sm"
            onClick={() => actions?.insertCode(templatedCode)}
          >
            Insert code
          </Button>
          {!detail && hasDetail && <MoreButton onClick={onForward} />}
        </HStack>
      </Box>
    </>
  );
};

interface CodePopUpProps extends BoxProps {
  setHovering: (hovering: boolean) => void;
  value: string;
  codeRef: RefObject<HTMLDivElement | null>;
}

// We draw the same code over the top in a portal so we can draw it
// above the scrollbar.
const CodePopUp = ({ setHovering, codeRef, value }: CodePopUpProps) => {
  // We need to re-render, we don't need the value.
  useScrollTop();
  useSplitViewContext();

  if (!codeRef.current) {
    return null;
  }
  return (
    <Portal>
      <Code
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        value={value}
        position="absolute"
        top={codeRef.current.getBoundingClientRect().top + "px"}
        left={codeRef.current.getBoundingClientRect().left + "px"}
      />
    </Portal>
  );
};

interface CodeProps extends BoxProps {
  value: string;
  ref?: Ref<HTMLDivElement>;
}

const Code = forwardRef<CodeProps, "pre">(
  ({ value, ...props }: CodeProps, ref) => {
    return (
      <Text
        ref={ref}
        as="pre"
        backgroundColor="rgb(247,245,242)"
        padding={5}
        borderTopRadius="lg"
        fontFamily="code"
        {...props}
      >
        {value}
      </Text>
    );
  }
);

const useScrollTop = () => {
  const scrollableRef = useScrollablePanelAncestor();
  const [scrollTop, setScrollTop] = useState(0);
  useLayoutEffect(() => {
    const scrollable = scrollableRef.current;
    if (!scrollable) {
      throw new Error();
    }
    setScrollTop(scrollable.scrollTop);
    const listener = () => setScrollTop(scrollable.scrollTop);
    scrollable.addEventListener("scroll", listener);
    return () => {
      scrollable.removeEventListener("scroll", listener);
    };
  }, [scrollableRef]);
  return scrollTop;
};

const templateCode = (code: ToolkitCode, option: string | undefined) => {
  if (!code.select || option === undefined) {
    return code.value;
  }

  return code.value.replace(code.select.placeholder, option);
};

export default TopicItem;