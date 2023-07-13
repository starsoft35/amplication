import { useMutation } from "@apollo/client";
import React, { useCallback, useEffect, useMemo } from "react";
import { match } from "react-router-dom";
import PageContent from "../../Layout/PageContent";

import { Snackbar } from "@amplication/ui/design-system";
import { FileUploader } from "../../Components/FileUploader";
import { EnumImages, SvgThemeImage } from "../../Components/SvgThemeImage";
import ActionLog from "../../VersionControl/ActionLog";
import * as models from "../../models";
import { AppRouteProps } from "../../routes/routesUtil";
import { useTracking } from "../../util/analytics";
import { AnalyticsEventNames } from "../../util/analytics-events.types";
import { formatError } from "../../util/error";
import "./EntitiesImport.scss";
import { GET_PENDING_CHANGES_STATUS } from "../../Workspaces/queries/projectQueries";
import { GET_ENTITIES_FOR_ENTITY_SELECT_FIELD } from "../../Components/EntitySelectField";
import { CREATE_ENTITIES_FORM_SCHEMA } from "./queries";
import useUserActionWatchStatus from "./useUserActionWatchStatus";

const PROCESSING_PRISMA_SCHEMA = "Processing Prisma schema";

const ACTION_LOG: models.Action = {
  id: "1",
  createdAt: new Date().toISOString(),
};

const ACTION_LOG_STEP: models.ActionStep = {
  id: "1",
  name: PROCESSING_PRISMA_SCHEMA,
  message: "Import Prisma schema file",
  status: models.EnumActionStepStatus.Running,
  createdAt: new Date().toISOString(),
  logs: [],
};

const ACTION_LOG_STEP_START: models.ActionLog = {
  id: "1",
  message: "Processing Prisma schema file",
  level: models.EnumActionLogLevel.Info,
  createdAt: new Date().toISOString(),
  meta: {},
};

type Props = AppRouteProps & {
  match: match<{
    workspace: string;
    project: string;
    resource: string;
  }>;
};

type TData = {
  createEntitiesFromPrismaSchema: models.UserAction;
};

const MAX_FILES = 1;
const ACCEPTED_FILE_TYPES = {
  "text/plain": [".prisma"],
};
const PAGE_TITLE = "Entities Import";

const CLASS_NAME = "entities-import";

const EntitiesImport: React.FC<Props> = ({ match, innerRoutes }) => {
  const [userAction, setUserAction] = React.useState<models.UserAction>(null);
  const { data: userActionData } = useUserActionWatchStatus(userAction);

  const { resource: resourceId, project: projectId } = match.params;
  const { trackEvent } = useTracking();

  const [createEntitiesFormSchema, { data, error, loading }] =
    useMutation<TData>(CREATE_ENTITIES_FORM_SCHEMA, {
      onCompleted: (data) => {
        setUserAction(data.createEntitiesFromPrismaSchema);
      },
      refetchQueries: [
        {
          query: GET_PENDING_CHANGES_STATUS,
          variables: {
            projectId: projectId,
          },
        },
        {
          query: GET_ENTITIES_FOR_ENTITY_SELECT_FIELD,
          variables: {
            resourceId,
          },
        },
      ],
    });

  const actionLog: models.Action = useMemo(() => {
    if (!data?.createEntitiesFromPrismaSchema) {
      return {
        ...ACTION_LOG,
        steps: [
          {
            ...ACTION_LOG_STEP,
            logs: [ACTION_LOG_STEP_START],
          },
        ],
      };
    }

    return {
      ...data.createEntitiesFromPrismaSchema.action,
      ...userActionData?.userAction?.action,
    };
  }, [data, loading, userActionData]);

  const errorMessage = formatError(error);

  const onFilesSelected = useCallback(
    (selectedFiles: File[]) => {
      const file = selectedFiles[0];

      trackEvent({
        eventName: AnalyticsEventNames.ImportPrismaSchemaSelectFile,
        fileName: file.name,
      });

      createEntitiesFormSchema({
        variables: {
          data: {
            userActionType: models.EnumUserActionType.DbSchemaImport,
            resource: {
              connect: {
                id: resourceId,
              },
            },
          },
          file,
        },
        context: {
          hasUpload: true,
        },
      }).catch(console.error);
    },
    [createEntitiesFormSchema, resourceId]
  );

  return (
    <PageContent className={CLASS_NAME} pageTitle={PAGE_TITLE}>
      <>
        <div className={`${CLASS_NAME}__header`}>
          <SvgThemeImage image={EnumImages.ImportPrisma} />
          <h2>Import Prisma schema file</h2>
          <div className={`${CLASS_NAME}__message`}>
            upload a Prisma schema file to import its content, and create
            entities and relations.
            <br />
            Only '*.prisma' files are supported.
          </div>
        </div>
        <div className={`${CLASS_NAME}__content`}>
          {loading || (data && data.createEntitiesFromPrismaSchema) ? (
            <>
              <ActionLog
                action={actionLog}
                title="Import Schema"
                versionNumber=""
              />
            </>
          ) : (
            <>
              <FileUploader
                onFilesSelected={onFilesSelected}
                maxFiles={MAX_FILES}
                acceptedFileTypes={ACCEPTED_FILE_TYPES}
              />
            </>
          )}
        </div>
        <Snackbar open={Boolean(error)} message={errorMessage} />
      </>
    </PageContent>
  );
};

export default EntitiesImport;
