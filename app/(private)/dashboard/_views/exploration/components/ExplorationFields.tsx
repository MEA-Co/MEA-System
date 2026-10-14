import { ArrowRight } from 'lucide-react';
import { Fragment } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type Exploration, groups } from '@/lib/exploration/fields';

import { ExplorationRecordFields } from './ExplorationRecordFields';
import { ExplorationRequiredMark } from './ExplorationRequiredMark';
import { ExplorationSectionCard } from './ExplorationSectionCard';
import { ExplorationWritingGuide } from './ExplorationWritingGuide';

export function ExplorationFields({
  values,
  onChange,
}: {
  values: Exploration['values'];
  onChange: (values: Exploration['values']) => void;
}) {
  return groups.map((group, index) => {
    const process = 'columns' in group;
    return (
      <ExplorationSectionCard
        key={group.title}
        title={group.title}
        index={index}
      >
        {group.description && (
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {group.description}
          </p>
        )}
        <div
          className={
            process
              ? 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)_1rem_minmax(0,1fr)]'
              : 'grid gap-x-5 gap-y-5 md:grid-cols-2'
          }
        >
          {group.fields.map((field, fieldIndex) => {
            if (field.key === 'semester' || field.key === 'recordArea')
              return null;
            if (field.key === 'grade' || field.key === 'recordType') {
              return (
                <ExplorationRecordFields
                  key={field.key}
                  section={field.key}
                  values={values}
                  onChange={onChange}
                />
              );
            }
            const multiline = 'multiline' in field && field.multiline;
            const fullWidth =
              'fullWidth' in field ? field.fullWidth : multiline;
            const required = 'required' in field && field.required === true;
            const props = {
              id: `activity-${field.key}`,
              name: field.key,
              value: values[field.key],
              placeholder: field.placeholder,
              required,
              'aria-describedby':
                'description' in field || 'example' in field
                  ? `activity-${field.key}-help`
                  : undefined,
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => onChange({ ...values, [field.key]: event.target.value }),
            };
            return (
              <Fragment key={field.key}>
                {process && fieldIndex > 0 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 rotate-90 place-self-center text-muted-foreground lg:row-span-2 lg:rotate-0"
                  />
                )}
                <div
                  className={
                    process
                      ? 'grid min-w-0 gap-2 lg:row-span-2 lg:grid-rows-subgrid'
                      : `min-w-0 space-y-2 ${fullWidth ? 'md:col-span-2' : ''}`
                  }
                >
                  <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <Label
                      htmlFor={props.id}
                      className="items-start gap-2 leading-5"
                    >
                      <span>
                        {field.label}
                        {'optional' in field && (
                          <span className="ml-1 font-normal text-muted-foreground">
                            (선택)
                          </span>
                        )}
                        {required && <ExplorationRequiredMark />}
                      </span>
                    </Label>
                    {'guide' in field && (
                      <ExplorationWritingGuide
                        title={field.label}
                        guide={field.guide}
                      />
                    )}
                  </div>
                  {multiline ? (
                    <Textarea
                      {...props}
                      className={
                        process
                          ? 'h-72 min-h-72 field-sizing-fixed resize-y leading-relaxed'
                          : 'min-h-32 resize-y leading-relaxed'
                      }
                    />
                  ) : (
                    <Input {...props} />
                  )}
                  {'description' in field && (
                    <p
                      id={`activity-${field.key}-help`}
                      className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground"
                    >
                      {field.description}
                    </p>
                  )}
                  {'example' in field && (
                    <p
                      id={`activity-${field.key}-help`}
                      className="text-sm leading-relaxed text-muted-foreground"
                    >
                      {field.example}
                    </p>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      </ExplorationSectionCard>
    );
  });
}
