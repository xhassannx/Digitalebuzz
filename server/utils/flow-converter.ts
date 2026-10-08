/**
 * Server-side utility to convert internal flow format to WhatsApp Flow JSON format
 * This is a copy of the client-side converter for use in the server
 */

type InternalField = {
  id: string;
  type: string;
  label?: string;
  placeholder?: string;
  instructions?: string;
  required?: boolean;
  options?: string[];
  inputType?: string;
  textType?: string;
  name?: string;
  [key: string]: any;
};

type InternalScreen = {
  id: string;
  title: string;
  fields: InternalField[];
  footerButton?: {
    text: string;
    action?: string;
  };
};

type WhatsAppFlowField = {
  type: string;
  text?: string;
  label?: string;
  name?: string;
  required?: boolean;
  "input-type"?: string;
  "data-source"?: Array<{
    id: string;
    title: string;
  }>;
  [key: string]: any;
};

type WhatsAppFlowFooterAction = {
  name: string;
  payload?: Record<string, string>;
  next?: { type: string; name: string };
};

type WhatsAppFlowScreen = {
  id: string;
  title: string;
  data?: Record<string, { type: string; __example__?: string }>;
  terminal?: boolean;
  success?: boolean;
  layout: {
    type: "SingleColumnLayout";
    children: Array<{
      type: "Form";
      name: string;
      children: Array<WhatsAppFlowField | {
        type: "Footer";
        label: string;
        "on-click-action": WhatsAppFlowFooterAction;
      }>;
    }>;
  };
};

/** Meta: field names can use letters, numbers, underscores */
function sanitizeFieldName(value: string, fallback: string): string {
  const s = String(value).replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return s.length > 0 ? s : fallback;
}

/** Meta: label must have at least 1 character; never send blank/empty */
function nonEmptyLabel(value: string | undefined, fallback: string): string {
  const s = String(value ?? '').trim();
  return s.length > 0 ? s : fallback;
}

/** Meta: screen id must be only alphabets and underscores (no digits). Generate deterministic id from index. */
function metaScreenId(screenIndex: number): string {
  if (screenIndex < 26) return `screen_${String.fromCharCode(97 + screenIndex)}`;
  let s = '';
  let n = screenIndex;
  while (n >= 0) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return `screen_${s}`;
}

/**
 * Convert internal field type to WhatsApp Flow field type (playground 7.3).
 * Note: date_picker with includeTime uses TextInput (DatePicker is date-only).
 */
function convertFieldTypeToWhatsAppType(fieldType: string, field?: InternalField): string {
  if (fieldType === 'date_picker' && field?.includeTime) {
    return 'TextInput';
  }
  const typeMap: Record<string, string> = {
    'large_heading': 'TextHeading',
    'small_heading': 'TextSubheading',
    'caption_text': 'TextSubheading',
    'body_text': 'TextHeading',
    'short_answer': 'TextInput',
    'paragraph': 'TextArea',
    'date_picker': 'DatePicker',
    'single_choice': 'RadioButtonsGroup',
    'multiple_choice': 'Dropdown',
    'dropdown': 'Dropdown',
    'opt_in': 'OptIn',
  };
  return typeMap[fieldType] || 'TextInput';
}

/**
 * Convert internal field to WhatsApp Flow field format
 */
function convertFieldToWhatsAppFormat(field: InternalField, index: number): WhatsAppFlowField | {
  type: "Footer";
  label: string;
  "on-click-action": {
    name: string;
    payload?: Record<string, string>;
  };
} {
  const rawName = field.name || `field_${index}`;
  const fieldName = sanitizeFieldName(rawName, `field_${index}`);

  // Handle footer button separately
  if (field.type === 'footer_button') {
    return {
      type: "Footer",
      label: nonEmptyLabel(field.label, "Continue"),
      "on-click-action": {
        name: "complete",
        payload: {},
      },
    };
  }

  const whatsAppType = convertFieldTypeToWhatsAppType(field.type, field);
  const isHeading = field.type === 'large_heading' || field.type === 'small_heading' ||
    field.type === 'caption_text' || field.type === 'body_text';
  const result: WhatsAppFlowField = {
    type: whatsAppType,
    ...(!isHeading && { name: fieldName, required: field.required || false }),
  };

  // Add type-specific properties (TextHeading only allows type + text per Meta)
  // Meta requires non-empty label (min 1 char) for components that have label
  const labelFallback = `Field ${index + 1}`;
  if (isHeading) {
    result.text = nonEmptyLabel(field.label, 'Text');
  } else if (field.type === 'short_answer') {
    result.label = nonEmptyLabel(field.label, labelFallback);
    result["input-type"] = field.inputType || 'text';
  } else if (field.type === 'paragraph') {
    result.label = nonEmptyLabel(field.label, labelFallback);
    result.required = field.required || false;
    // TextArea: no input-type
  } else if (field.type === 'date_picker') {
    if (field.includeTime) {
      result.label = nonEmptyLabel(field.label, labelFallback);
      result["input-type"] = 'text';
      result["helper-text"] = 'Format: DD-MM-YYYY HH:mm';
    } else {
      result.label = nonEmptyLabel(field.label, labelFallback);
    }
  } else if (field.type === 'single_choice' || field.type === 'multiple_choice' || field.type === 'dropdown') {
    result.label = nonEmptyLabel(field.label, labelFallback);
    if (field.options && field.options.length > 0) {
      result["data-source"] = field.options.map((opt, idx) => ({
        id: `${idx}_${opt.toUpperCase().replace(/\s+/g, '_')}`,
        title: opt,
      }));
    }
  } else if (field.type === 'opt_in') {
    result.label = nonEmptyLabel(field.label, labelFallback);
  } else if (!isHeading) {
    // Any other type with a label (e.g. unknown -> TextInput)
    result.label = nonEmptyLabel(field.label, labelFallback);
  }

  return result;
}

/** Get payload keys (screen_N_fieldName) for input fields on a screen */
function getScreenPayloadKeys(screen: InternalScreen, screenIndex: number): string[] {
  const isHeadingType = (t: string) => ['large_heading', 'small_heading', 'caption_text', 'body_text'].includes(t);
  const keys: string[] = [];
  screen.fields.forEach((field, fieldIndex) => {
    if (isHeadingType(field.type)) return;
    const rawName = field.name || `field_${fieldIndex}`;
    const fieldName = sanitizeFieldName(rawName, `field_${fieldIndex}`);
    keys.push(`screen_${screenIndex}_${fieldName}`);
  });
  return keys;
}

/**
 * Convert internal screen format to WhatsApp Flow JSON format (playground 7.3)
 */
export function convertToWhatsAppFlowFormat(screens: InternalScreen[]): {
  version: string;
  screens: WhatsAppFlowScreen[];
} {
  const lastIndex = screens.length - 1;
  const isHeadingType = (t: string) => ['large_heading', 'small_heading', 'caption_text', 'body_text'].includes(t);

  // Precompute payload keys per screen for data schema and complete payload
  const payloadKeysPerScreen = screens.map((s, i) => getScreenPayloadKeys(s, i));
  const allPreviousPayloadKeys = (upToScreenIndex: number): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < upToScreenIndex; i++) keys.push(...payloadKeysPerScreen[i]);
    return keys;
  };

  return {
    version: "7.3",
    screens: screens.map((screen, screenIndex) => {
      const formChildren: Array<WhatsAppFlowField | {
        type: "Footer";
        label: string;
        "on-click-action": WhatsAppFlowFooterAction;
      }> = [];

      // Convert fields (skip empty text-only components — Meta rejects blank `text`)
      screen.fields.forEach((field, fieldIndex) => {
        if (isHeadingType(field.type) && !String(field.label ?? '').trim()) {
          return;
        }
        const convertedField = convertFieldToWhatsAppFormat(field, fieldIndex);
        formChildren.push(convertedField);
      });

      const isLastScreen = screenIndex === lastIndex;

      // Add footer button if exists (Meta requires a Footer on every terminal screen)
      if (screen.footerButton || !isLastScreen) {
        if (isLastScreen) {
          const payload: Record<string, string> = {};
          // Current screen form fields
          screen.fields.forEach((field, fieldIndex) => {
            if (isHeadingType(field.type)) return;
            const rawName = field.name || `field_${fieldIndex}`;
            const fieldName = sanitizeFieldName(rawName, `field_${fieldIndex}`);
            payload[`screen_${screenIndex}_${fieldName}`] = `\${form.${fieldName}}`;
          });
          // Previous screens' data (playground: screen_0_xxx from ${data.screen_0_xxx})
          allPreviousPayloadKeys(screenIndex).forEach((key) => {
            payload[key] = `\${data.${key}}`;
          });
          formChildren.push({
            type: "Footer",
            label: nonEmptyLabel(screen.footerButton?.text, "Continue"),
            "on-click-action": {
              name: screen.footerButton?.action || "complete",
              payload,
            },
          });
        } else {
          const nextScreenId = metaScreenId(screenIndex + 1);
          const navigatePayload: Record<string, string> = {};
          screen.fields.forEach((field, fieldIndex) => {
            if (isHeadingType(field.type)) return;
            const rawName = field.name || `field_${fieldIndex}`;
            const fieldName = sanitizeFieldName(rawName, `field_${fieldIndex}`);
            navigatePayload[`screen_${screenIndex}_${fieldName}`] = `\${form.${fieldName}}`;
          });
          // Forward data collected on earlier screens (required by next screen's data model)
          allPreviousPayloadKeys(screenIndex).forEach((key) => {
            navigatePayload[key] = `\${data.${key}}`;
          });
          formChildren.push({
            type: "Footer",
            label: nonEmptyLabel(screen.footerButton?.text, "Continue"),
            "on-click-action": {
              name: "navigate",
              next: { type: "screen", name: nextScreenId },
              payload: navigatePayload,
            },
          });
        }
      } else if (isLastScreen) {
        // Meta requires a Footer on terminal screens; add default "Complete" if none configured
        const payload: Record<string, string> = {};
        screen.fields.forEach((field, fieldIndex) => {
          if (isHeadingType(field.type)) return;
          const rawName = field.name || `field_${fieldIndex}`;
          const fieldName = sanitizeFieldName(rawName, `field_${fieldIndex}`);
          payload[`screen_${screenIndex}_${fieldName}`] = `\${form.${fieldName}}`;
        });
        allPreviousPayloadKeys(screenIndex).forEach((key) => {
          payload[key] = `\${data.${key}}`;
        });
        formChildren.push({
          type: "Footer",
          label: "Complete",
          "on-click-action": {
            name: "complete",
            payload,
          },
        });
      }

      const screenId = metaScreenId(screenIndex);
      // Screen "data": empty for first screen; schema for received payload from previous screens (playground 7.3)
      const dataSchema: Record<string, { type: string; __example__?: string }> = {};
      if (screenIndex > 0) {
        allPreviousPayloadKeys(screenIndex).forEach((key) => {
          dataSchema[key] = { type: "string", "__example__": "Example" };
        });
      }

      const screenResult: WhatsAppFlowScreen = {
        id: screenId,
        title: screen.title,
        terminal: isLastScreen,
        ...(isLastScreen && { success: true }),
        layout: {
          type: "SingleColumnLayout",
          children: [
            {
              type: "Form",
              name: "form",
              children: formChildren,
            },
          ],
        },
      };
      if (screenIndex === 0) {
        screenResult.data = {};
      } else if (Object.keys(dataSchema).length > 0) {
        screenResult.data = dataSchema;
      }
      return screenResult;
    }),
  };
}

