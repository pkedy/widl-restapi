import { parseType } from "@wapc/widl";
import { shouldIncludeHandler } from "@wapc/widl-codegen/utils";
import {
  Context,
  Writer,
  BaseVisitor,
  Kind,
  Named,
  TypeDefinition,
  FieldDefinition,
  Optional,
  Type,
  ListType,
  MapType,
  StringValue,
} from "@wapc/widl/ast";

interface HostDirective {
  value: string;
}

interface SchemesDirective {
  value: string[];
}

interface ConsumesDirective {
  value: string[];
}

interface ProducesDirective {
  value: string[];
}

interface SummaryDirective {
  value: string;
}

interface PathDirective {
  value: string;
}

const statusCodes = new Map<string, string>([
  ["OK", "200"],
  ["CREATED", "201"],
  ["NOT_FOUND", "400"],
  ["DEFAULT", "default"],
]);

interface ResponseDirective {
  status: string;
  returns?: string;
  description?: string;
  examples?: { [k: string]: string };
}

////////////////////////////////////////////////////

interface OpenAPIv2 {
  swagger: string;
  info?: Info; // required
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  paths: Paths;
  definitions: Definitions;
  // parameters: Parameters
  // responses: Responses
  // securityDefinitions: SecurityDefinitions
  // security: Security
  tags?: Tag[];
  externalDocs?: ExternalDocumentation;
}

interface Info {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
  version?: string;
}

interface Contact {
  name?: string;
  url?: string;
  email?: string;
}

interface License {
  name: string;
  url?: string;
}

type Paths = { [k: string]: PathItem };

type PathItem = { [method: string]: Operation };

interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
  operationId?: string;
  consumes?: string[];
  produces?: string[];
  parameters?: Parameter[];
  responses?: Responses;
  schemes?: string[];
  deprecated?: boolean;
  // security?: Security
}

type Responses = { [status: string]: Response };

interface Parameter {
  name: string;
  in: ParameterIn;
  description?: string;
  required: boolean;
  schema?: Schema;
  type?: Types;
  format?: string;
  allowEmptyValue?: boolean;
  items?: Schema;
  collectionFormat?: CollectionFormat;
  default?: any;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  uniqueItems?: boolean;
  enum?: any[];
  multipleOf?: number;
}

type Definitions = { [name: string]: Schema };

interface Schema {
  $ref?: string;
  description?: string;
  properties?: Definitions;
  additionalProperties?: Schema;
  required?: string[];
  schema?: Schema;
  type?: Types;
  format?: string;
  allowEmptyValue?: boolean;
  items?: Schema;
  collectionFormat?: CollectionFormat;
  default?: any;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  uniqueItems?: boolean;
  enum?: any[];
  multipleOf?: number;
}

enum ParameterIn {
  QUERY = "query",
  HEADER = "header",
  PATH = "path",
  FORM_DATA = "formData",
  BODY = "body",
}

enum Types {
  STRING = "string",
  NUMBER = "number",
  INTEGER = "integer",
  BOOLEAN = "boolean",
  ARRAY = "array",
  FILE = "file",
  OBJECT = "object",
}

enum CollectionFormat {
  CSV = "csv",
  SSV = "ssv",
  TSV = "tsv",
  PIPES = "pipes",
  MULTI = "multi",
}

interface Response {
  description?: string;
  schema?: Schema;
  headers?: Headers;
  examples?: Examples;
}

type Headers = { [k: string]: Schema };
type Examples = { [mimeType: string]: any };

interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
}

interface ExternalDocumentation {
  description?: string;
  url?: string; // required
}

export class OpenAPIV2Visitor extends BaseVisitor {
  private root: OpenAPIv2 = {
    swagger: "2.0",
    info: undefined,
    host: undefined,
    basePath: undefined,
    schemes: undefined,
    consumes: undefined,
    produces: undefined,
    paths: {},
    definitions: {},
    // parameters: Parameters
    // responses: Responses
    // securityDefinitions: SecurityDefinitions
    // security: Security
    tags: undefined,
    externalDocs: undefined,
  };

  protected path: string = "";
  protected method: string = "";
  protected operation?: Operation;
  protected parameter?: Parameter;
  protected definition?: Schema;
  protected field?: Schema;

  constructor(writer: Writer) {
    super(writer);
  }

  visitDocumentAfter(context: Context): void {
    this.write(JSON.stringify(this.root, null, 2));
  }

  visitNamespace(context: Context): void {
    const ns = context.namespace;
    ns.annotation("info", (a) => {
      this.root.info = a.convert<Info>();
    });
    ns.annotation("externalDocs", (a) => {
      this.root.externalDocs = a.convert<ExternalDocumentation>();
    });
    ns.annotation("host", (a) => {
      this.root.host = a.convert<HostDirective>().value;
    });
    ns.annotation("path", (a) => {
      this.root.basePath = a.convert<PathDirective>().value;
    });
    ns.annotation("schemes", (a) => {
      this.root.schemes = a.convert<SchemesDirective>().value;
    });
    ns.annotation("consumes", (a) => {
      this.root.consumes = a.convert<ConsumesDirective>().value;
    });
    ns.annotation("produces", (a) => {
      this.root.produces = a.convert<ProducesDirective>().value;
    });
  }

  visitOperationBefore(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const inter = context.interface;
    const role = context.role;
    const oper = context.operation!;
    let path = "";
    if (inter) {
      inter.annotation("path", (a) => {
        path += a.convert<PathDirective>().value;
      });
    }
    if (role) {
      role.annotation("path", (a) => {
        path += a.convert<PathDirective>().value;
      });
    }
    oper.annotation("path", (a) => {
      path += a.convert<PathDirective>().value;
    });
    this.path = path;

    let pathItem = this.root.paths[path];
    if (!pathItem) {
      pathItem = {};
      this.root.paths[path] = pathItem;
    }

    let method = "";
    ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].forEach(
      (m) => {
        oper.annotation(m, () => {
          method = m.toLowerCase();
        });
      }
    );
    this.method = method;

    this.operation = {
      operationId: oper.name.value,
      summary: undefined,
      description: stringValueValue(oper.description),
    };
    oper.annotation("summary", (a) => {
      this.operation!.summary = a.convert<SummaryDirective>().value;
    });
    oper.annotation("deprecated", (a) => {
      this.operation!.deprecated = true;
    });
    pathItem[method] = this.operation;
  }

  visitParameter(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    if (!this.operation!.parameters) {
      this.operation!.parameters = [];
    }

    const param = context.parameter!;
    let paramIn: ParameterIn = ParameterIn.BODY;
    if (this.path.indexOf(`{` + param.name.value + `}`) != -1) {
      paramIn = ParameterIn.PATH;
    }
    if (param.annotation("query")) {
      paramIn = ParameterIn.QUERY;
    }

    const p: Parameter = {
      name: param.name.value,
      in: paramIn,
      description: stringValueValue(param.description),
      required: !param.type.isKind(Kind.Optional),
    };

    if (param.type.isKind(Kind.ListType)) {
    }

    switch (paramIn) {
      case ParameterIn.PATH:
        let typeFormat: TypeFormat | undefined = undefined;
        if (param.type.isKind(Kind.Named)) {
          const named = param.type as Named;
          typeFormat = primitiveTypeMap.get(named.name.value);
        }
        if (!typeFormat) {
          throw Error(
            `path parameter "${
              param.name.value
            }" must be a required type: found "${param.type.getKind()}"`
          );
        }
        this.operation!.parameters.push({
          ...p,
          ...typeFormat,
        });
        return;

      case ParameterIn.BODY:
        if (!param.type.isKind(Kind.Named)) {
          throw Error(
            `body parameter "${
              param.name.value
            }" must be a required type: found "${param.type.getKind()}"`
          );
        }

        const typeName = param.type as Named;
        let type = context.allTypes.get(typeName.name.value) as TypeDefinition;

        const regex = /\{([_A-Za-z]?[_0-9A-Za-z]*)}/gm;
        let m;

        const pathFields = new Map<string, FieldDefinition>();
        while ((m = regex.exec(this.path)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          const fieldName = m[1] as string;
          const fd = type.fields.find((f) => f.name.value == fieldName);
          if (fd) {
            pathFields.set(m[1], fd);
          }
        }

        if (pathFields.size > 0) {
          const bodyFields: FieldDefinition[] = [];
          type.fields.forEach((f) => {
            if (!pathFields.has(f.name.value)) {
              bodyFields.push(f);
            }
          });
          const want = fieldsSignature(bodyFields);

          for (let t of context.types) {
            if (want === fieldsSignature(t.fields)) {
              pathFields.forEach((f) => {
                const named = f.type as Named;
                const primitive = primitiveTypeMap.get(named.name.value);
                if (primitive) {
                  this.operation!.parameters!.push({
                    name: f.name.value,
                    in: ParameterIn.PATH,
                    description: stringValueValue(f.description),
                    required: true,
                    ...primitive,
                  });
                }
              });

              type = t;
              break;
            }
          }
        }

        p.schema = {
          $ref: "#/definitions/" + type.name.value,
        };
        this.operation!.parameters.push(p);
        return;

      case ParameterIn.QUERY:
        switch (param.type.getKind()) {
          case Kind.ListType: {
            const list = param.type as ListType;
            const type = list.type;
            let typeFormat: TypeFormat | undefined = undefined;
            if (type.isKind(Kind.Named)) {
              const named = type as Named;
              typeFormat = primitiveTypeMap.get(named.name.value);
            }
            if (!typeFormat) {
              throw Error(
                `query parameter "${
                  param.name.value
                }" must be a built-type: found "${type.getKind()}"`
              );
            }
            this.operation!.parameters.push({
              ...p,
              items: {
                ...typeFormat,
              },
            });
            break;
          }

          case Kind.Named:
            const named = param.type as Named;
            const primitive = primitiveTypeMap.get(named.name.value);

            // primitive type
            if (primitive) {
              this.operation!.parameters.push({
                ...p,
                ...primitive,
              });
              return;
            }

            // query parameters encapsulated inside a type
            const typeDef = context.allTypes.get(named.name.value);
            if (typeDef && typeDef.isKind(Kind.TypeDefinition)) {
              const type = typeDef as TypeDefinition;
              type.fields.map((f) => {
                const named = f.type as Named;
                const primitive = primitiveTypeMap.get(named.name.value);
                if (primitive) {
                  this.operation!.parameters!.push({
                    name: f.name.value,
                    in: ParameterIn.QUERY,
                    description: stringValueValue(f.description),
                    required: !f.type.isKind(Kind.Optional),
                    ...primitive,
                  });
                }
              });
              return;
            }
            throw Error(
              `query parameter "${param.name.value}" must be a built-type: found "${named.name.value}"`
            );
        }
    }

    this.operation!.parameters.push(p);
  }

  visitOperationAfter(context: Context): void {
    if (!shouldIncludeHandler(context)) {
      return;
    }
    const oper = context.operation!;
    const responses: Responses = {};

    const responseDirectives: ResponseDirective[] = [];
    let found2xx = false;
    oper.annotations.map((a) => {
      if (a.name.value != "response") {
        return;
      }

      const resp = a.convert<ResponseDirective>();
      const code = statusCodes.get(resp.status) || "default";
      if (code.substring(0, 1) == "2") {
        found2xx = true;
      }
      responseDirectives.push(resp);
    });

    if (!found2xx) {
      const status = this.method == "post" ? "201" : "200";
      responses[status] = {
        description: "Success",
        schema: this.typeToSchema(oper.type),
      };
    }

    responseDirectives.map((resp) => {
      const code = statusCodes.get(resp.status) || "default";
      let type = oper.type;
      if (resp.returns) {
        type = parseType(resp.returns);
      }
      responses[code] = {
        description: resp.description,
        examples: resp.examples,
        schema: this.typeToSchema(type),
      };
    });

    if (Object.keys(responses).length > 0) {
      this.operation!.responses = responses;
    }

    this.path = "";
  }

  visitType(context: Context): void {
    const type = context.type!;
    this.root.definitions[type.name.value] = {
      description: stringValueValue(type.description),
      ...this.typeDefinitionToSchema(type),
    };
  }

  typeDefinitionToSchema(type: TypeDefinition): Schema {
    return {
      type: Types.OBJECT,
      description: stringValueValue(type.description),
      properties: this.fieldsToDefinitions(type.fields),
      required: this.requestFieldList(type.fields),
    };
  }

  requestFieldList(fields: FieldDefinition[]): string[] {
    const required: string[] = [];
    fields.map((f) => {
      if (!f.type.isKind(Kind.Optional)) {
        required.push(f.name.value);
      }
    });
    return required;
  }

  fieldsToDefinitions(fields: FieldDefinition[]): Definitions {
    const defs: { [name: string]: Schema } = {};
    fields.map((f) => {
      defs[f.name.value] = {
        description: stringValueValue(f.description),
        ...this.typeToSchema(f.type),
      };
    });
    return defs;
  }

  typeToSchema(type: Type, required: boolean = true): Schema {
    switch (type.getKind()) {
      case Kind.Optional:
        const optional = type as Optional;
        return this.typeToSchema(optional.type, false);
      case Kind.Named:
        const named = type as Named;
        const primitive = primitiveTypeMap.get(named.name!.value);
        if (primitive) {
          return {
            ...primitive,
          };
        }
        return {
          $ref: "#/definitions/" + named.name.value,
        };
      case Kind.ListType:
        const list = type as ListType;
        return {
          type: Types.ARRAY,
          items: this.typeToSchema(list.type),
        };
      case Kind.MapType:
        const map = type as MapType;
        let valid = false;
        if (map.keyType.isKind(Kind.Named)) {
          valid = (map.keyType as Named).name.value == "string";
        }
        if (!valid) {
          throw Error(`maps must have a key type of string`);
        }
        return {
          type: Types.OBJECT,
          additionalProperties: this.typeToSchema(map.valueType),
        };
      default:
        throw Error(`unexpected kind "${type.getKind()}"`);
    }
  }
}

interface TypeFormat {
  type: Types;
  format?: string;
  minimum?: number;
  maximum?: number;
}
const primitiveTypeMap = new Map<string, TypeFormat>([
  ["i8", { type: Types.INTEGER, format: "int32", minimum: -128, maximum: 127 }],
  [
    "i16",
    { type: Types.INTEGER, format: "int32", minimum: -32768, maximum: 32767 },
  ],
  ["i32", { type: Types.INTEGER, format: "int32" }],
  ["i64", { type: Types.INTEGER, format: "int64" }],
  ["u8", { type: Types.INTEGER, format: "int32", minimum: 0, maximum: 255 }],
  ["u16", { type: Types.INTEGER, format: "int32", minimum: 0, maximum: 65535 }],
  [
    "u32",
    { type: Types.INTEGER, format: "int64", minimum: 0, maximum: 4294967295 },
  ],
  ["u64", { type: Types.INTEGER, format: "int64", minimum: 0 }],
  ["f32", { type: Types.NUMBER, format: "float" }],
  ["f64", { type: Types.NUMBER, format: "double" }],
  ["string", { type: Types.STRING }],
  ["bytes", { type: Types.STRING, format: "byte" }],
  ["boolean", { type: Types.BOOLEAN }],
  ["date", { type: Types.STRING, format: "date" }],
  ["datetime", { type: Types.STRING, format: "date-time" }],
]);

function fieldsSignature(fields: FieldDefinition[]): string {
  let sig = "";
  let clone = Object.assign([], fields) as FieldDefinition[];
  clone = clone.sort((a, b) => (a.name.value > b.name.value ? 1 : -1));
  clone.forEach((f) => {
    sig += `${f.name.value}: ${typeSignature(f.type)}\n`;
  });
  return sig;
}

function typeSignature(type: Type): string {
  switch (type.getKind()) {
    case Kind.Named:
      return (type as Named).name.value;
    case Kind.ListType:
      return `[${typeSignature((type as ListType).type)}]`;
    case Kind.MapType:
      const map = type as MapType;
      return `{${typeSignature(map.keyType)}: ${typeSignature(map.valueType)}}`;
    case Kind.Optional:
      return `${typeSignature((type as Optional).type)}?`;
    default:
      throw new Error("unexpected kind: " + type.getKind());
  }
}

function stringValueValue(sv?: StringValue): string | undefined {
  return (sv == undefined) ? undefined : sv.value;
}