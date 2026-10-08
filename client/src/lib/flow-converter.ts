// @ts-nocheck
/**
 * Utility functions to convert between our internal flow format and WhatsApp Flow JSON format
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

type WhatsAppFlowScreen = {
  id: string;
  title: string;
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
        "on-click-action": {
          name: string;
          payload?: Record<string, string>;
        };
      }>;
    }>;
  };
};

/**
 * Convert internal field type to WhatsApp Flow field type.
 * Note: date_picker with includeTime uses TextInput (DatePicker is date-only).
 */
function convertFieldTypeToWhatsAppType(fieldType: string, field?: InternalField): string {
  if (fieldType === 'date_picker' && field?.includeTime) {
    return 'TextInput';
  }
  const typeMap: Record<string, string> = {
    'large_heading': 'TextHeading',
    'small_heading': 'TextHeading',
    'caption_text': 'TextHeading',
    'body_text': 'TextHeading',
    'short_answer': 'TextInput',
    'paragraph': 'TextInput',
    'date_picker': 'DatePicker',
    'single_choice': 'Dropdown',
    'multiple_choice': 'Dropdown',
    'dropdown': 'Dropdown',
    'opt_in': 'Checkbox',
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
  const fieldName = field.name || `field_${index}`;
  
  // Handle footer button separately
  if (field.type === 'footer_button') {
    return {
      type: "Footer",
      label: field.label || "Continue",
      "on-click-action": {
        name: "complete",
        payload: {},
      },
    };
  }

  const whatsAppType = convertFieldTypeToWhatsAppType(field.type, field);
  const result: WhatsAppFlowField = {
    type: whatsAppType,
    name: fieldName,
    required: field.required || false,
  };

  // Add type-specific properties
  if (field.type === 'large_heading' || field.type === 'small_heading' || 
      field.type === 'caption_text' || field.type === 'body_text') {
    result.text = field.label || '';
  } else if (field.type === 'short_answer' || field.type === 'paragraph') {
    result.label = field.label || '';
    result["input-type"] = field.inputType || 'text';
  } else if (field.type === 'date_picker') {
    if (field.includeTime) {
      result.label = field.label || '';
      result["input-type"] = 'text';
      result["helper-text"] = 'Format: DD-MM-YYYY HH:mm';
    } else {
      result.label = field.label || '';
    }
  } else if (field.type === 'single_choice' || field.type === 'multiple_choice' || field.type === 'dropdown') {
    result.label = field.label || '';
    if (field.options && field.options.length > 0) {
      result["data-source"] = field.options.map((opt, idx) => ({
        id: `${idx}_${opt.toUpperCase().replace(/\s+/g, '_')}`,
        title: opt,
      }));
    }
  }

  return result;
}

/**
 * Convert internal screen format to WhatsApp Flow JSON format
 */
export function convertToWhatsAppFlowFormat(screens: InternalScreen[]): {
  version: string;
  screens: WhatsAppFlowScreen[];
} {
  return {
    version: "7.2",
    screens: screens.map((screen, screenIndex) => {
      const formChildren: Array<WhatsAppFlowField | {
        type: "Footer";
        label: string;
        "on-click-action": {
          name: string;
          payload?: Record<string, string>;
        };
      }> = [];

      // Convert fields
      screen.fields.forEach((field, fieldIndex) => {
        const convertedField = convertFieldToWhatsAppFormat(field, fieldIndex);
        formChildren.push(convertedField);
      });

      // Add footer button if exists
      if (screen.footerButton) {
        const payload: Record<string, string> = {};
        screen.fields.forEach((field, fieldIndex) => {
          const fieldName = field.name || `field_${fieldIndex}`;
          payload[`screen_${screenIndex}_${fieldName}`] = `\${form.${fieldName}}`;
        });

        formChildren.push({
          type: "Footer",
          label: screen.footerButton.text,
          "on-click-action": {
            name: screen.footerButton.action || "complete",
            payload,
          },
        });
      }

      return {
        id: screen.id,
        title: screen.title,
        terminal: true,
        success: true,
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
    }),
  };
}

function extractFooterFromLayout(screen: {
  layout?: {
    children?: Array<{
      type: string;
      children?: Array<{
        type: string;
        label?: string;
        "on-click-action"?: { name: string };
      }>;
    }>;
  };
}): { text?: string; action?: string } | undefined {
  if (!screen.layout?.children) return undefined;
  for (const layoutChild of screen.layout.children) {
    if (layoutChild.type === "Form" && layoutChild.children) {
      for (const child of layoutChild.children) {
        if (child.type === "Footer") {
          return {
            text: child.label || undefined,
            action: child["on-click-action"]?.name,
          };
        }
      }
    }
  }
  return undefined;
}

/**
 * Ensure each screen has a writable footerButton.text for the flow builder editor.
 * Footer labels may live only on layout Footer nodes or use `label` instead of `text`.
 */
export function normalizeScreensForEditor(screens: InternalScreen[]): InternalScreen[] {
  return screens.map((screen) => {
    const fromLayout = extractFooterFromLayout(screen);
    const existing = screen.footerButton as { text?: string; label?: string; action?: string } | undefined;
    const text =
      existing?.text?.trim() ||
      existing?.label?.trim() ||
      fromLayout?.text?.trim() ||
      "Continue";
    const action = existing?.action || fromLayout?.action;
    return {
      ...screen,
      footerButton: {
        text,
        ...(action ? { action } : {}),
      },
    };
  });
}

/**
 * Convert WhatsApp Flow JSON format to internal format
 */
export function convertFromWhatsAppFlowFormat(whatsAppFlow: {
  version?: string;
  screens: WhatsAppFlowScreen[];
}): InternalScreen[] {
  return whatsAppFlow.screens.map((screen) => {
    const fields: InternalField[] = [];
    let footerButton: { text: string; action?: string } | undefined;

    // Extract fields from layout structure
    if (screen.layout?.children) {
      screen.layout.children.forEach((layoutChild) => {
        if (layoutChild.type === "Form" && layoutChild.children) {
          layoutChild.children.forEach((child) => {
            if (child.type === "Footer") {
              footerButton = {
                text: child.label || "Continue",
                action: child["on-click-action"]?.name,
              };
            } else {
              // Convert WhatsApp field to internal format
              const field: InternalField = {
                id: `field-${Date.now()}-${fields.length}`,
                type: convertWhatsAppTypeToFieldType(child.type),
                name: child.name,
                required: child.required || false,
              };

              if (child.type === "TextHeading" || child.type === "TextSubheading") {
                field.label = child.text || '';
                field.textType = child.type === "TextSubheading" ? 'small_heading' : 'large_heading';
              } else if (child.type === "TextInput") {
                const helperText = (child["helper-text"] || '').toString();
                if (helperText.includes('DD-MM-YYYY HH:mm')) {
                  field.type = 'date_picker';
                  field.includeTime = true;
                }
                field.label = child.label || '';
                field.inputType = child["input-type"] || 'text';
              } else if (child.type === "TextArea") {
                field.label = child.label || '';
                field.inputType = 'text';
              } else if (child.type === "DatePicker") {
                field.label = child.label || '';
                field.includeTime = false;
              } else if (child.type === "Dropdown" || child.type === "RadioButtonsGroup") {
                field.label = child.label || '';
                if (child["data-source"]) {
                  field.options = child["data-source"].map((item: { title: string }) => item.title);
                }
              } else if (child.type === "Checkbox") {
                field.label = child.label || '';
              }

              fields.push(field);
            }
          });
        }
      });
    }

    return {
      id: screen.id,
      title: screen.title,
      fields,
      footerButton,
    };
  });
}

/**
 * Convert WhatsApp Flow field type to internal field type (playground 7.3)
 */
function convertWhatsAppTypeToFieldType(whatsAppType: string): string {
  const typeMap: Record<string, string> = {
    'TextHeading': 'large_heading',
    'TextSubheading': 'small_heading',
    'TextInput': 'short_answer',
    'TextArea': 'paragraph',
    'DatePicker': 'date_picker',
    'Dropdown': 'dropdown',
    'RadioButtonsGroup': 'single_choice',
    'Checkbox': 'opt_in',
  };
  return typeMap[whatsAppType] || 'short_answer';
}

