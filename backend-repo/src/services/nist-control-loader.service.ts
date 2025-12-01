// NIST 800-53 Control Loader Service
// Loads comprehensive NIST 800-53 Rev 5 control data into the database

import { storage } from '../storage';
import type { InsertControl } from '../schema';

export interface NIST800_53Control {
  id: string;
  title: string;
  description: string;
  family: string;
  baseline: string[];
  priority: string;
  enhancement?: string;
  supplementalGuidance?: string;
  requirements?: string;
  objective?: string;
  status: string;
}

export class NISTControlLoaderService {
  private readonly NIST_800_53_CONTROLS: NIST800_53Control[] = [
    // Access Control (AC) Family
    {
      id: 'AC-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate access control policy and procedures that address purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must establish access control policies that address: (a) purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) procedures to facilitate the implementation of the access control policy.',
      objective: 'To establish and maintain access control governance through comprehensive policies and procedures.',
      supplementalGuidance: 'Access control policy and procedures address the controls in the AC family. The policy should be reviewed and updated as necessary.',
      status: 'active'
    },
    {
      id: 'AC-2',
      title: 'Account Management',
      description: 'Manage information system accounts, including establishing, activating, modifying, disabling, and removing accounts.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) identify and select information system account types; (b) establish conditions for group and role membership; (c) specify authorized users of the information system, group and role membership, and access authorizations; (d) require approvals by designated organizational personnel for requests to create information system accounts.',
      objective: 'To ensure proper lifecycle management of all system accounts.',
      supplementalGuidance: 'Account management includes the identification of account types, establishment of conditions for group/role membership, and assignment of associated access authorizations.',
      status: 'active'
    },
    {
      id: 'AC-3',
      title: 'Access Enforcement',
      description: 'Enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.',
      objective: 'To prevent unauthorized access to information and system resources.',
      supplementalGuidance: 'Access control policies control access between active entities or subjects and passive entities or objects in information systems.',
      status: 'active'
    },
    {
      id: 'AC-4',
      title: 'Information Flow Enforcement',
      description: 'Control information flows within the system and between interconnected systems based on approved authorizations.',
      family: 'Access Control',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must control information flows within the system and between interconnected systems based on approved authorizations.',
      objective: 'To prevent unauthorized information transfers and ensure data remains within authorized boundaries.',
      supplementalGuidance: 'Information flow control regulates where information can travel within an information system and between information systems.',
      status: 'active'
    },
    {
      id: 'AC-5',
      title: 'Separation of Duties',
      description: 'Separate duties of individuals to reduce the risk of malevolent activity without collusion.',
      family: 'Access Control',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) separate duties of individuals; (b) document separation of duties of individuals; and (c) define information system access authorizations to support separation of duties.',
      objective: 'To prevent fraud and errors by ensuring no single individual has control over critical processes.',
      supplementalGuidance: 'Separation of duties addresses the potential for abuse of authorized privileges and helps to reduce the risk of malevolent activity without collusion.',
      status: 'active'
    },
    {
      id: 'AC-6',
      title: 'Least Privilege',
      description: 'Employ the principle of least privilege, allowing only authorized accesses for users which are necessary to accomplish assigned tasks.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must employ the principle of least privilege, allowing only authorized accesses for users (or processes acting on behalf of users) which are necessary to accomplish assigned tasks in accordance with organizational missions and business functions.',
      objective: 'To minimize the attack surface by limiting user privileges to only what is necessary.',
      supplementalGuidance: 'Organizations employ least privilege for specific duties and information systems. The principle of least privilege is also applied to information system processes.',
      status: 'active'
    },
    {
      id: 'AC-7',
      title: 'Unsuccessful Logon Attempts',
      description: 'Enforce a limit of consecutive invalid logon attempts by a user and take subsequent action when the maximum number of attempts is exceeded.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must: (a) enforce a limit of organization-defined consecutive invalid logon attempts by a user during an organization-defined time period; and (b) automatically lock the account/node for an organization-defined time period or lock the account/node until released by an administrator when the maximum number of unsuccessful attempts is exceeded.',
      objective: 'To prevent brute force attacks and unauthorized access attempts.',
      supplementalGuidance: 'This control applies regardless of whether the logon occurs via a local or network connection.',
      status: 'active'
    },
    {
      id: 'AC-8',
      title: 'System Use Notification',
      description: 'Display an approved system use notification message or banner before granting access to the system.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must: (a) display an approved system use notification message or banner before granting access to the information system that provides privacy and security notices consistent with applicable federal laws, Executive Orders, directives, policies, regulations, standards, and guidance; and (b) retain the notification message or banner on the screen until users acknowledge the usage conditions and take explicit actions to log on to or further access the information system.',
      objective: 'To ensure users are aware of usage policies and legal implications.',
      supplementalGuidance: 'System use notifications can be implemented using messages or warning banners displayed before individuals log in to information systems.',
      status: 'active'
    },

    // Additional Critical Access Control Controls
    {
      id: 'AC-11',
      title: 'Device Lock',
      description: 'Prevent further access to the system by initiating a device lock after a time period of inactivity or upon receiving a request from a user.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must: (a) prevent further access to the system by initiating a device lock after organization-defined time period of inactivity or upon receiving a request from a user; and (b) retain the device lock until the user reestablishes access using established identification and authentication procedures.',
      objective: 'To prevent unauthorized access when devices are unattended.',
      supplementalGuidance: 'Device locks are temporary actions taken when users stop work and move away from the immediate vicinity of information systems but do not want to log out because of the temporary nature of their absences.',
      status: 'active'
    },
    {
      id: 'AC-12',
      title: 'Session Termination',
      description: 'Automatically terminate a user session after a defined condition.',
      family: 'Access Control',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must automatically terminate a user session after: (a) organization-defined conditions or trigger events requiring session disconnect; or (b) organization-defined time period of session inactivity.',
      objective: 'To prevent unauthorized access through abandoned sessions.',
      supplementalGuidance: 'Session termination addresses the security problems of session hijacking and session fixation. When sessions are terminated, the associated temporary files are deleted.',
      status: 'active'
    },
    {
      id: 'AC-14',
      title: 'Permitted Actions Without Identification or Authentication',
      description: 'Identify and document specific user actions that can be performed without identification or authentication.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P3',
      requirements: 'Organizations must: (a) identify user actions that can be performed on the information system without identification or authentication consistent with organizational missions/business functions; and (b) document and provide supporting rationale in the security plan for the information system, user actions not requiring identification or authentication.',
      objective: 'To explicitly define and control anonymous access capabilities.',
      supplementalGuidance: 'This control addresses situations where users perform certain activities on information systems without identification or authentication.',
      status: 'active'
    },
    {
      id: 'AC-17',
      title: 'Remote Access',
      description: 'Establish and document usage restrictions, configuration/connection requirements, and implementation guidance for each type of remote access allowed.',
      family: 'Access Control',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) establish and document usage restrictions, configuration/connection requirements, and implementation guidance for each type of remote access allowed; and (b) authorize remote access to the information system prior to allowing such connections.',
      objective: 'To control and monitor remote access to organizational systems.',
      supplementalGuidance: 'Remote access is access to organizational information systems by users communicating through external networks.',
      status: 'active'
    },
    {
      id: 'AC-18',
      title: 'Wireless Access',
      description: 'Establish usage restrictions, configuration/connection requirements, and implementation guidance for wireless access.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) establish usage restrictions, configuration/connection requirements, and implementation guidance for wireless access; and (b) authorize wireless access to the information system prior to allowing such connections.',
      objective: 'To control and secure wireless network access.',
      supplementalGuidance: 'Wireless technologies include microwave, packet radio, IEEE 802.11x, and Bluetooth.',
      status: 'active'
    },
    {
      id: 'AC-19',
      title: 'Access Control for Mobile Devices',
      description: 'Establish usage restrictions, configuration requirements, connection requirements, and implementation guidance for organization-controlled mobile devices.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) establish usage restrictions, configuration requirements, connection requirements, and implementation guidance for organization-controlled mobile devices; and (b) authorize the connection of mobile devices to organizational information systems.',
      objective: 'To secure mobile device access to organizational systems.',
      supplementalGuidance: 'Mobile devices include smartphones, tablets, E-readers, and notebook computers with wireless capability.',
      status: 'active'
    },
    {
      id: 'AC-20',
      title: 'Use of External Systems',
      description: 'Establish terms and conditions for authorized individuals to access the system from external systems.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Organizations must: (a) establish terms and conditions, consistent with any trust relationships established with other organizations owning, operating, and/or maintaining external information systems, allowing authorized individuals to access the information system from external information systems; and (b) identify the types of applications authorized individuals are permitted to access when using external information systems.',
      objective: 'To control access from external systems while maintaining security.',
      supplementalGuidance: 'External systems are information systems or components of information systems for which organizations typically have no direct control.',
      status: 'active'
    },
    {
      id: 'AC-22',
      title: 'Publicly Accessible Content',
      description: 'Designate individuals authorized to make information publicly accessible and train them on the consequences of publishing information.',
      family: 'Access Control',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P3',
      requirements: 'Organizations must: (a) designate individuals authorized to make information publicly accessible; (b) train authorized individuals to ensure that publicly accessible information does not contain nonpublic information; (c) review the proposed content of information prior to posting onto the publicly accessible information system to ensure that nonpublic information is not included; and (d) review the content on the publicly accessible information system for nonpublic information at least quarterly and remove such information, if discovered.',
      objective: 'To prevent unauthorized disclosure through public content.',
      supplementalGuidance: 'In accordance with federal laws, Executive Orders, directives, policies, regulations, standards, and guidance, the public is not authorized to have access to nonpublic information.',
      status: 'active'
    },

    // Audit and Accountability (AU) Family
    {
      id: 'AU-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate audit and accountability policy and procedures.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate audit and accountability policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the audit and accountability policy.',
      objective: 'To establish governance for audit and accountability functions.',
      supplementalGuidance: 'Audit and accountability policy and procedures address the controls in the AU family.',
      status: 'active'
    },
    {
      id: 'AU-2',
      title: 'Event Logging',
      description: 'Identify the types of events that the system is capable of logging.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) identify the types of events that the information system is capable of auditing in support of the audit function; (b) coordinate the security audit function with other organizational entities requiring audit-related information; and (c) provide a rationale for why the auditable events are deemed to be adequate to support after-the-fact investigations of security incidents.',
      objective: 'To ensure appropriate events are identified for audit logging.',
      supplementalGuidance: 'An event is any observable occurrence in an organizational information system.',
      status: 'active'
    },
    {
      id: 'AU-3',
      title: 'Content of Audit Records',
      description: 'Ensure that audit records contain information that establishes the following: type of event, when the event occurred, where the event occurred, source of the event, outcome of the event, and identity of any individuals or subjects associated with the event.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must ensure that audit records contain information that establishes what type of event occurred, when the event occurred, where the event occurred, source of the event, outcome of the event, and the identity of any individuals or subjects associated with the event.',
      objective: 'To ensure audit records contain sufficient information for analysis.',
      supplementalGuidance: 'Audit record content that may be necessary to satisfy the requirement of this control includes time stamps, source and destination addresses, user/process identifiers, event descriptions, success/fail indications, filenames involved, and access control or flow control rules invoked.',
      status: 'active'
    },

    // Additional Critical Audit and Accountability Controls
    {
      id: 'AU-4',
      title: 'Audit Log Storage Capacity',
      description: 'Allocate audit log storage capacity and configure auditing to reduce the likelihood of such capacity being exceeded.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must allocate audit log storage capacity in accordance with organization-defined audit log retention requirements and configure auditing to reduce the likelihood of such capacity being exceeded.',
      objective: 'To ensure audit logs are preserved and storage capacity is adequate.',
      supplementalGuidance: 'Organizations consider the types of auditing to be performed and the audit processing requirements when allocating audit storage capacity.',
      status: 'active'
    },
    {
      id: 'AU-5',
      title: 'Response to Audit Logging Process Failures',
      description: 'Alert appropriate organizational officials in the event of an audit logging process failure and take additional actions.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must: (a) alert designated organizational officials in the event of an audit logging process failure; and (b) take additional actions including shutting down the information system, overwriting oldest audit records, or stopping the generation of audit records.',
      objective: 'To ensure audit logging failures are detected and addressed.',
      supplementalGuidance: 'Audit logging process failures include software/hardware errors, failures in the audit capturing mechanisms, and audit storage capacity being reached or exceeded.',
      status: 'active'
    },
    {
      id: 'AU-6',
      title: 'Audit Record Review, Analysis, and Reporting',
      description: 'Review and analyze system audit records for indications of inappropriate or unusual activity and report findings to appropriate officials.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) review and analyze information system audit records at least weekly for indications of inappropriate or unusual activity; and (b) report findings to designated organizational officials.',
      objective: 'To detect security incidents and unauthorized activities through audit analysis.',
      supplementalGuidance: 'Audit review, analysis, and reporting covers information security-related auditing performed by organizations including auditing that results from monitoring of account usage, remote access, wireless connectivity, mobile device connection, configuration settings, system component inventory, use of maintenance tools and nonlocal maintenance, physical access, temperature and humidity, equipment delivery and removal, communications at the information system boundaries, use of mobile code, and use of VoIP.',
      status: 'active'
    },
    {
      id: 'AU-8',
      title: 'Time Stamps',
      description: 'Use internal system clocks to generate time stamps for audit records and record time stamps that can be mapped to Coordinated Universal Time (UTC).',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must: (a) use internal system clocks to generate time stamps for audit records; and (b) record time stamps for audit records that can be mapped to Coordinated Universal Time (UTC) or Greenwich Mean Time (GMT) and meets organization-defined granularity of time measurement.',
      objective: 'To provide reliable timestamps for audit correlation and analysis.',
      supplementalGuidance: 'Time stamps generated by the information system include date and time. Time is commonly expressed in UTC, a modern continuation of GMT, or local time with an offset from UTC.',
      status: 'active'
    },
    {
      id: 'AU-9',
      title: 'Protection of Audit Information',
      description: 'Protect audit information and audit logging tools from unauthorized access, modification, and deletion.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must protect audit information and audit logging tools from unauthorized access, modification, and deletion.',
      objective: 'To maintain audit integrity and prevent tampering.',
      supplementalGuidance: 'Audit information includes all information needed to successfully audit information system activity, such as audit logs, audit log settings, and audit reports.',
      status: 'active'
    },
    {
      id: 'AU-11',
      title: 'Audit Record Retention',
      description: 'Retain audit records for a time period consistent with records retention policy to provide support for after-the-fact investigations.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P3',
      requirements: 'Organizations must retain audit records for an organization-defined time period consistent with records retention policy to provide support for after-the-fact investigations of security incidents and to meet regulatory and organizational information retention requirements.',
      objective: 'To preserve audit evidence for investigations and compliance.',
      supplementalGuidance: 'Organizations develop records retention policies and procedures that meet federal records retention requirements.',
      status: 'active'
    },
    {
      id: 'AU-12',
      title: 'Audit Record Generation',
      description: 'Provide audit record generation capability for the list of auditable events defined in AU-2 at all information system components.',
      family: 'Audit and Accountability',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must: (a) provide audit record generation capability for the auditable events defined in AU-2 a. at all information system components where audit capability is deployed/available; (b) allow designated organizational personnel to select which auditable events are to be audited by specific components of the information system; and (c) generate audit records for the events defined in AU-2 d. with the content defined in AU-3.',
      objective: 'To ensure comprehensive audit logging capabilities.',
      supplementalGuidance: 'Audit record generation occurs at the application and operating system level.',
      status: 'active'
    },

    // Configuration Management (CM) Family
    {
      id: 'CM-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate configuration management policy and procedures.',
      family: 'Configuration Management',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate configuration management policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the configuration management policy.',
      objective: 'To establish governance for configuration management activities.',
      supplementalGuidance: 'Configuration management policy and procedures address the controls in the CM family.',
      status: 'active'
    },
    {
      id: 'CM-2',
      title: 'Baseline Configuration',
      description: 'Develop, document, and maintain a current baseline configuration of the system.',
      family: 'Configuration Management',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must develop, document, and maintain under configuration control, a current baseline configuration of the information system.',
      objective: 'To establish and maintain a secure baseline configuration.',
      supplementalGuidance: 'Baseline configurations serve as a basis for future builds, releases, and/or changes to information systems.',
      status: 'active'
    },
    {
      id: 'CM-3',
      title: 'Configuration Change Control',
      description: 'Determine and document the types of changes to the system that are configuration-controlled.',
      family: 'Configuration Management',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) determine the types of changes to the information system that are configuration-controlled; (b) review proposed configuration-controlled changes to the information system and approve or disapprove such changes with explicit consideration for security impact analyses; (c) document configuration change decisions associated with the information system; (d) implement approved configuration-controlled changes to the information system; (e) retain records of configuration-controlled changes to the information system; (f) audit and review activities associated with configuration-controlled changes to the information system; and (g) coordinate and provide oversight for configuration change control activities.',
      objective: 'To ensure changes are properly controlled and authorized.',
      supplementalGuidance: 'Configuration-controlled changes to the system may include major hardware, software, or firmware components.',
      status: 'active'
    },

    // Critical Configuration Management Controls
    {
      id: 'CM-4',
      title: 'Impact Analyses',
      description: 'Analyze changes to the system to determine potential security and privacy impacts prior to change implementation.',
      family: 'Configuration Management',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Organizations must analyze changes to the information system to determine potential security impacts prior to change implementation.',
      objective: 'To identify and mitigate security risks from system changes.',
      supplementalGuidance: 'Organizational personnel with information security responsibilities conduct impact analyses.',
      status: 'active'
    },
    {
      id: 'CM-5',
      title: 'Access Restrictions for Change',
      description: 'Define, document, approve, and enforce physical and logical access restrictions associated with changes to the system.',
      family: 'Configuration Management',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must define, document, approve, and enforce physical and logical access restrictions associated with changes to the information system.',
      objective: 'To control who can make changes to systems.',
      supplementalGuidance: 'Any changes to the information system components can have significant effects on the overall security of the system.',
      status: 'active'
    },
    {
      id: 'CM-6',
      title: 'Configuration Settings',
      description: 'Establish and document configuration settings for components employed within the system using security and privacy configuration checklists.',
      family: 'Configuration Management',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) establish and document configuration settings for information technology products employed within the information system using security configuration checklists that reflect the most restrictive mode consistent with operational requirements; (b) implement the configuration settings; (c) identify, document, and approve any deviations from established configuration settings; (d) monitor and control changes to the configuration settings in accordance with organizational policies and procedures.',
      objective: 'To establish secure baseline configurations.',
      supplementalGuidance: 'Configuration settings are the set of parameters that can be changed in hardware, software, or firmware components of the information system that affect the security posture and/or functionality of the system.',
      status: 'active'
    },
    {
      id: 'CM-7',
      title: 'Least Functionality',
      description: 'Configure the system to provide only mission-essential capabilities.',
      family: 'Configuration Management',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) configure the information system to provide only essential capabilities; and (b) prohibit or restrict the use of functions, ports, protocols, and/or services as defined in applicable security configuration checklists.',
      objective: 'To minimize attack surface by disabling unnecessary functionality.',
      supplementalGuidance: 'Information systems can provide a wide variety of functions and services. Some of the functions and services provided by default may not be necessary to support essential organizational operations.',
      status: 'active'
    },
    {
      id: 'CM-8',
      title: 'System Component Inventory',
      description: 'Develop and document an inventory of system components that accurately reflects the system.',
      family: 'Configuration Management',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop and document an inventory of information system components that accurately reflects the current information system; includes all components within the authorization boundary of the information system; is at the level of granularity deemed necessary for tracking and reporting; and includes organization-defined information deemed necessary to achieve effective information system component accountability; and (b) review and update the information system component inventory at least monthly.',
      objective: 'To maintain accurate visibility of all system components.',
      supplementalGuidance: 'Organizations may choose to implement centralized information system component inventories that include components from all organizational information systems.',
      status: 'active'
    },

    // Identification and Authentication (IA) Family
    {
      id: 'IA-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate identification and authentication policy and procedures.',
      family: 'Identification and Authentication',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate identification and authentication policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the identification and authentication policy.',
      objective: 'To establish governance for identification and authentication functions.',
      supplementalGuidance: 'Identification and authentication policy and procedures address the controls in the IA family.',
      status: 'active'
    },
    {
      id: 'IA-2',
      title: 'Identification and Authentication (Organizational Users)',
      description: 'Uniquely identify and authenticate organizational users and associate that unique identification with processes acting on behalf of those users.',
      family: 'Identification and Authentication',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must uniquely identify and authenticate organizational users (or processes acting on behalf of organizational users).',
      objective: 'To ensure only authorized users can access the system.',
      supplementalGuidance: 'Organizational users include employees or individuals that organizations deem to have equivalent status of employees.',
      status: 'active'
    },
    {
      id: 'IA-3',
      title: 'Device Identification and Authentication',
      description: 'Uniquely identify and authenticate devices before establishing a connection.',
      family: 'Identification and Authentication',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must uniquely identify and authenticate devices before establishing a connection.',
      objective: 'To ensure only authorized devices can connect to the system.',
      supplementalGuidance: 'Devices requiring unique device-to-network identification and authentication may be defined by type, by device, or by a combination of type/device.',
      status: 'active'
    },

    // Critical Identification and Authentication Controls
    {
      id: 'IA-4',
      title: 'Identifier Management',
      description: 'Manage system identifiers by receiving authorization from a designated organizational official to assign an individual, group, role, service, or device identifier.',
      family: 'Identification and Authentication',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must manage information system identifiers by: (a) receiving authorization from a designated organizational official to assign an individual, group, role, or device identifier; (b) selecting an identifier that identifies an individual, group, role, or device; (c) assigning the identifier to the intended individual, group, role, or device; (d) preventing reuse of identifiers for a defined time period; and (e) disabling the identifier after a defined time period of inactivity.',
      objective: 'To ensure proper lifecycle management of system identifiers.',
      supplementalGuidance: 'Common device identifiers include media access control (MAC) addresses, Internet protocol (IP) addresses, or device-unique token identifiers.',
      status: 'active'
    },
    {
      id: 'IA-5',
      title: 'Authenticator Management',
      description: 'Manage system authenticators by verifying the identity of the individual, group, role, service, or device receiving the authenticator.',
      family: 'Identification and Authentication',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must manage information system authenticators by: (a) verifying, as part of the initial authenticator distribution, the identity of the individual, group, role, or device receiving the authenticator; (b) establishing initial authenticator content for authenticators defined by the organization; (c) ensuring that authenticators have sufficient strength of mechanism for their intended use; (d) establishing and implementing administrative procedures for initial authenticator distribution, for lost/compromised or damaged authenticators, and for revoking authenticators; (e) changing default content of authenticators prior to information system installation; (f) establishing minimum and maximum lifetime restrictions and reuse conditions for authenticators.',
      objective: 'To ensure authenticators are properly managed throughout their lifecycle.',
      supplementalGuidance: 'Individual authenticators include passwords, tokens, biometrics, PKI certificates, and key cards.',
      status: 'active'
    },
    {
      id: 'IA-8',
      title: 'Identification and Authentication (Non-Organizational Users)',
      description: 'Uniquely identify and authenticate non-organizational users or processes acting on behalf of non-organizational users.',
      family: 'Identification and Authentication',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must uniquely identify and authenticate non-organizational users (or processes acting on behalf of non-organizational users).',
      objective: 'To control access by external users.',
      supplementalGuidance: 'Non-organizational users include system users other than organizational users explicitly covered by IA-2.',
      status: 'active'
    },
    {
      id: 'IA-11',
      title: 'Re-authentication',
      description: 'Require users and devices to re-authenticate when circumstances or situations require re-authentication.',
      family: 'Identification and Authentication',
      baseline: ['Moderate', 'High'],
      priority: 'P3',
      requirements: 'Information systems must require users to re-authenticate when organization-defined circumstances or situations require re-authentication.',
      objective: 'To verify user identity when accessing sensitive resources.',
      supplementalGuidance: 'In addition to the re-authentication requirements associated with session locks, organizations may require re-authentication of individuals and/or devices in other situations.',
      status: 'active'
    },

    // System and Communications Protection (SC) Family
    {
      id: 'SC-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate system and communications protection policy and procedures.',
      family: 'System and Communications Protection',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate system and communications protection policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the system and communications protection policy.',
      objective: 'To establish governance for system and communications protection.',
      supplementalGuidance: 'System and communications protection policy and procedures address the controls in the SC family.',
      status: 'active'
    },
    {
      id: 'SC-7',
      title: 'Boundary Protection',
      description: 'Monitor and control communications at the external interfaces to the system and at key internal interfaces within the system.',
      family: 'System and Communications Protection',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must: (a) monitor and control communications at the external boundary of the system and at key internal boundaries within the system; (b) implement subnetworks for publicly accessible system components that are physically or logically separated from internal organizational networks; and (c) connect to external networks or information systems only through managed interfaces consisting of boundary protection devices arranged in accordance with an organizational security architecture.',
      objective: 'To control network traffic and prevent unauthorized access.',
      supplementalGuidance: 'Managed interfaces include gateways, routers, firewalls, guards, network-based malicious code analysis and virtualization systems, or encrypted tunnels implemented within a security architecture.',
      status: 'active'
    },
    {
      id: 'SC-8',
      title: 'Transmission Confidentiality and Integrity',
      description: 'Protect the confidentiality and integrity of transmitted information.',
      family: 'System and Communications Protection',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must protect the confidentiality and/or integrity of transmitted information.',
      objective: 'To protect information during transmission.',
      supplementalGuidance: 'This control applies to both internal and external networks and all types of information system components from which information can be transmitted.',
      status: 'active'
    },

    // Critical System and Communications Protection Controls
    {
      id: 'SC-2',
      title: 'Separation of System and User Functionality',
      description: 'Separate user functionality, including user interface services, from system management functionality.',
      family: 'System and Communications Protection',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must separate user functionality (including user interface services) from information system management functionality.',
      objective: 'To isolate administrative functions from user operations.',
      supplementalGuidance: 'Information system management functionality includes functions necessary to administer databases, network components, workstations, or servers.',
      status: 'active'
    },
    {
      id: 'SC-3',
      title: 'Security Function Isolation',
      description: 'Isolate security functions from nonsecurity functions.',
      family: 'System and Communications Protection',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must isolate security functions from nonsecurity functions.',
      objective: 'To protect critical security functions from interference.',
      supplementalGuidance: 'The information system isolates security functions from nonsecurity functions by means of an isolation boundary implemented within the information system via partitions and domains.',
      status: 'active'
    },
    {
      id: 'SC-4',
      title: 'Information in Shared Resources',
      description: 'Prevent unauthorized and unintended information transfer via shared system resources.',
      family: 'System and Communications Protection',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must prevent unauthorized and unintended information transfer via shared system resources.',
      objective: 'To prevent information leakage through shared resources.',
      supplementalGuidance: 'This control prevents information produced by the actions of prior users/roles from being available to any current users/roles that obtain access to shared system resources.',
      status: 'active'
    },
    {
      id: 'SC-5',
      title: 'Denial-of-Service Protection',
      description: 'Protect against or limit the effects of denial-of-service attacks.',
      family: 'System and Communications Protection',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must protect against or limit the effects of organization-defined types of denial of service attacks by employing organization-defined security safeguards.',
      objective: 'To maintain system availability during attacks.',
      supplementalGuidance: 'A variety of technologies exist to limit or eliminate the effects of denial of service attacks.',
      status: 'active'
    },
    {
      id: 'SC-12',
      title: 'Cryptographic Key Establishment and Management',
      description: 'Establish and manage cryptographic keys when cryptography is employed within the system.',
      family: 'System and Communications Protection',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must establish and manage cryptographic keys for required cryptography employed within the information system in accordance with organization-defined requirements for key generation, distribution, storage, access, and destruction.',
      objective: 'To ensure proper cryptographic key lifecycle management.',
      supplementalGuidance: 'Cryptographic key management and establishment can be performed either as a capability closely related to the information system or as a separate capability under the control of the organization.',
      status: 'active'
    },
    {
      id: 'SC-13',
      title: 'Cryptographic Protection',
      description: 'Determine the cryptographic uses and type of cryptography required; and implement the required cryptographic protection.',
      family: 'System and Communications Protection',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must implement organization-defined cryptographic uses and type of cryptography required for each use in accordance with applicable federal laws, Executive Orders, directives, policies, regulations, and standards.',
      objective: 'To protect information using appropriate cryptographic methods.',
      supplementalGuidance: 'Cryptography can be employed to support many security solutions including the protection of classified and controlled unclassified information.',
      status: 'active'
    },

    // System and Information Integrity (SI) Family
    {
      id: 'SI-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate system and information integrity policy and procedures.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate system and information integrity policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the system and information integrity policy.',
      objective: 'To establish governance for system and information integrity.',
      supplementalGuidance: 'System and information integrity policy and procedures address the controls in the SI family.',
      status: 'active'
    },
    {
      id: 'SI-2',
      title: 'Flaw Remediation',
      description: 'Identify, report, and correct system flaws.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) identify, report, and correct information system flaws; (b) test software and firmware updates related to flaw remediation for effectiveness and potential side effects before installation; (c) install security-relevant software and firmware updates within an organization-defined time period of the release of the updates.',
      objective: 'To ensure timely identification and remediation of security flaws.',
      supplementalGuidance: 'Flaw remediation is an ongoing activity that requires continuous monitoring.',
      status: 'active'
    },
    {
      id: 'SI-3',
      title: 'Malicious Code Protection',
      description: 'Implement malicious code protection mechanisms and update malicious code protection mechanisms whenever new releases are available.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) implement malicious code protection mechanisms at information system entry and exit points to detect and eradicate malicious code; (b) update malicious code protection mechanisms whenever new releases are available in accordance with organizational configuration management policy and procedures; (c) configure malicious code protection mechanisms.',
      objective: 'To prevent, detect, and eradicate malicious code.',
      supplementalGuidance: 'Information system entry and exit points include, for example, firewalls, electronic mail servers, web servers, proxy servers, remote-access servers, workstations, notebook computers, and mobile devices.',
      status: 'active'
    },
    {
      id: 'SI-4',
      title: 'System Monitoring',
      description: 'Monitor the system to detect attacks and indicators of potential attacks.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) monitor the information system to detect: (1) attacks and indicators of potential attacks in accordance with monitoring objectives; and (2) unauthorized local, network, and remote connections; (b) identify unauthorized use of the information system through monitoring.',
      objective: 'To detect security incidents and unauthorized activities.',
      supplementalGuidance: 'System monitoring includes external and internal monitoring. External monitoring includes the observation of events occurring at the information system boundary.',
      status: 'active'
    },

    // Additional Critical System and Information Integrity Controls
    {
      id: 'SI-5',
      title: 'Security Alerts, Advisories, and Directives',
      description: 'Receive system security alerts, advisories, and directives from designated external organizations on an ongoing basis.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) receive information system security alerts, advisories, and directives from designated external organizations on an ongoing basis; (b) generate internal security alerts, advisories, and directives as deemed necessary; (c) disseminate security alerts, advisories, and directives; and (d) implement security directives in accordance with established time frames, or notify the issuing organization of the degree of noncompliance.',
      objective: 'To stay informed of current security threats and vulnerabilities.',
      supplementalGuidance: 'The United States Computer Emergency Readiness Team (US-CERT) generates security alerts and advisories to maintain situational awareness across the federal government.',
      status: 'active'
    },
    {
      id: 'SI-7',
      title: 'Software, Firmware, and Information Integrity',
      description: 'Identify unauthorized changes to software, firmware, and information.',
      family: 'System and Information Integrity',
      baseline: ['Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) employ integrity verification tools to detect unauthorized changes to organization-defined software, firmware, and information; and (b) take organization-defined actions when unauthorized changes to the software, firmware, and information are detected.',
      objective: 'To detect unauthorized modifications to critical system components.',
      supplementalGuidance: 'Unauthorized changes to software, firmware, and information can occur due to errors or malicious activity.',
      status: 'active'
    },
    {
      id: 'SI-8',
      title: 'Spam Protection',
      description: 'Implement spam protection mechanisms at system entry and exit points.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Organizations must: (a) employ spam protection mechanisms at information system entry and exit points to detect and take action on unsolicited messages; and (b) update spam protection mechanisms when new releases are available in accordance with organizational configuration management policy and procedures.',
      objective: 'To prevent spam and potential malicious content delivery.',
      supplementalGuidance: 'Information system entry and exit points include firewalls, electronic mail servers, web servers, proxy servers, remote-access servers, workstations, mobile devices, and notebook computers.',
      status: 'active'
    },
    {
      id: 'SI-10',
      title: 'Information Input Validation',
      description: 'Check the validity of information inputs.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Information systems must check the validity of organization-defined information inputs.',
      objective: 'To prevent processing of malformed or malicious input data.',
      supplementalGuidance: 'Checking the valid syntax and semantics of information system inputs can help to ensure that inputs conform to standards.',
      status: 'active'
    },
    {
      id: 'SI-11',
      title: 'Error Handling',
      description: 'Generate error messages that provide information necessary for corrective actions without revealing information that could be exploited.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Information systems must: (a) generate error messages that provide information necessary for corrective actions without revealing information that could be exploited by adversaries; and (b) reveal error messages only to designated personnel.',
      objective: 'To provide useful error information while preventing information disclosure.',
      supplementalGuidance: 'Organizations carefully consider the structure/content of error messages.',
      status: 'active'
    },
    {
      id: 'SI-12',
      title: 'Information Management and Retention',
      description: 'Manage and retain information within the system and information output from the system.',
      family: 'System and Information Integrity',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Organizations must manage and retain information within the information system and information output from the system in accordance with applicable federal laws, Executive Orders, directives, policies, regulations, standards, and operational requirements.',
      objective: 'To ensure proper information lifecycle management.',
      supplementalGuidance: 'Information management and retention requirements cover the full life cycle of information, in some cases extending beyond the disposal of information systems.',
      status: 'active'
    },

    // Critical Missing Control Families - Essential Controls
    
    // Awareness and Training (AT) Family
    {
      id: 'AT-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate awareness and training policy and procedures.',
      family: 'Awareness and Training',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate awareness and training policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the awareness and training policy.',
      objective: 'To establish governance for security awareness and training programs.',
      supplementalGuidance: 'Awareness and training policy and procedures address the controls in the AT family.',
      status: 'active'
    },
    {
      id: 'AT-2',
      title: 'Literacy Training and Awareness',
      description: 'Provide security and privacy literacy training to system users.',
      family: 'Awareness and Training',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must provide security awareness training to information system users (including managers, senior executives, and contractors): (a) as part of initial training for new users; (b) when required by information system changes; and (c) at least annually thereafter.',
      objective: 'To ensure users understand their security responsibilities.',
      supplementalGuidance: 'Organizations determine the appropriate content of security awareness training and literacy training based on the specific requirements of their organizations.',
      status: 'active'
    },
    {
      id: 'AT-3',
      title: 'Role-Based Training',
      description: 'Provide role-based security and privacy training to personnel with assigned security roles and responsibilities.',
      family: 'Awareness and Training',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must provide role-based security training to personnel with assigned security roles and responsibilities: (a) before authorizing access to the information system or performing assigned duties; (b) when required by information system changes; and (c) at least annually thereafter.',
      objective: 'To ensure personnel with security responsibilities have appropriate training.',
      supplementalGuidance: 'Organizations determine the appropriate content of security training based on the assigned roles and responsibilities of individuals.',
      status: 'active'
    },
    {
      id: 'AT-4',
      title: 'Training Records',
      description: 'Document and monitor information system security training activities.',
      family: 'Awareness and Training',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P3',
      requirements: 'Organizations must: (a) document and monitor individual information system security training activities including basic security awareness training and specific information system security training; and (b) retain individual training records for an organization-defined time period.',
      objective: 'To maintain records of security training completion.',
      supplementalGuidance: 'Documentation for specialized training may be maintained by individual supervisors at the option of the organization.',
      status: 'active'
    },

    // Contingency Planning (CP) Family
    {
      id: 'CP-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate contingency planning policy and procedures.',
      family: 'Contingency Planning',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate contingency planning policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the contingency planning policy.',
      objective: 'To establish governance for business continuity and disaster recovery.',
      supplementalGuidance: 'Contingency planning policy and procedures address the controls in the CP family.',
      status: 'active'
    },
    {
      id: 'CP-2',
      title: 'Contingency Plan',
      description: 'Develop a contingency plan for the system that identifies essential missions and business functions.',
      family: 'Contingency Planning',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop a contingency plan for the information system that identifies essential missions and business functions and associated contingency requirements; provides recovery objectives, restoration priorities, and metrics; addresses contingency roles, responsibilities, assigned individuals with contact information; addresses maintaining essential missions and business functions despite an information system disruption, compromise, or failure; addresses eventual, full information system restoration without deterioration of the security safeguards originally planned and implemented; and is reviewed and approved by designated officials within the organization.',
      objective: 'To ensure business continuity during disruptions.',
      supplementalGuidance: 'Contingency planning for information systems is part of an overall organizational program for achieving continuity of operations for mission/business functions.',
      status: 'active'
    },
    {
      id: 'CP-3',
      title: 'Contingency Training',
      description: 'Provide contingency plan training to system users consistent with assigned roles and responsibilities.',
      family: 'Contingency Planning',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Organizations must provide contingency plan training to information system users consistent with assigned roles and responsibilities: (a) within an organization-defined time period of assuming a contingency role or responsibility; (b) when required by information system changes; and (c) at least annually thereafter.',
      objective: 'To ensure personnel can execute contingency procedures.',
      supplementalGuidance: 'Contingency plan training is directly related to the assigned roles and responsibilities of organizational personnel to ensure that the appropriate content and level of detail is included in such training.',
      status: 'active'
    },
    {
      id: 'CP-4',
      title: 'Contingency Plan Testing',
      description: 'Test the contingency plan for the system using defined tests to determine the effectiveness of the plan.',
      family: 'Contingency Planning',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Organizations must: (a) test the contingency plan for the information system at least annually using organization-defined tests to determine the effectiveness of the plan and the organizational readiness to execute the plan; (b) review the contingency plan test results; and (c) initiate corrective actions, if needed.',
      objective: 'To validate contingency plan effectiveness.',
      supplementalGuidance: 'Methods for testing contingency plans to determine the effectiveness of the plans and to identify potential weaknesses in the plans include, for example, walk-through and tabletop exercises, checklists, simulations (parallel, full interrupt), and comprehensive exercises.',
      status: 'active'
    },

    // Incident Response (IR) Family
    {
      id: 'IR-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate incident response policy and procedures.',
      family: 'Incident Response',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate incident response policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the incident response policy.',
      objective: 'To establish governance for incident response capabilities.',
      supplementalGuidance: 'Incident response policy and procedures address the controls in the IR family.',
      status: 'active'
    },
    {
      id: 'IR-2',
      title: 'Incident Response Training',
      description: 'Provide incident response training to system users consistent with assigned roles and responsibilities.',
      family: 'Incident Response',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P2',
      requirements: 'Organizations must provide incident response training to information system users consistent with assigned roles and responsibilities: (a) within an organization-defined time period of assuming an incident response role or responsibility; (b) when required by information system changes; and (c) at least annually thereafter.',
      objective: 'To ensure personnel can respond effectively to security incidents.',
      supplementalGuidance: 'Incident response training provided by organizations is linked to the assigned roles and responsibilities of organizational personnel to ensure that the appropriate content and level of detail is included in such training.',
      status: 'active'
    },
    {
      id: 'IR-4',
      title: 'Incident Handling',
      description: 'Implement an incident handling capability for security incidents.',
      family: 'Incident Response',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) implement an incident handling capability for security incidents that includes preparation, detection and analysis, containment, eradication, and recovery; (b) coordinate incident handling activities with contingency planning activities; and (c) incorporate lessons learned from ongoing incident handling activities into incident response procedures, training, and testing, and implement the resulting changes accordingly.',
      objective: 'To provide structured response to security incidents.',
      supplementalGuidance: 'Organizations recognize that incident handling capability is dependent on the capabilities of organizational information systems and the mission/business processes being supported by those systems.',
      status: 'active'
    },
    {
      id: 'IR-6',
      title: 'Incident Reporting',
      description: 'Require personnel to report suspected security incidents to the organizational incident response capability.',
      family: 'Incident Response',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must require personnel to report suspected security incidents to the organizational incident response capability within an organization-defined time period.',
      objective: 'To ensure timely incident notification and response.',
      supplementalGuidance: 'The intent of this control is to address both specific incident reporting requirements within an organization and the formal incident reporting requirements for federal agencies and their subordinate organizations.',
      status: 'active'
    },

    // Risk Assessment (RA) Family
    {
      id: 'RA-1',
      title: 'Policy and Procedures',
      description: 'Develop, document, and disseminate risk assessment policy and procedures.',
      family: 'Risk Assessment',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) develop, document, and disseminate risk assessment policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and (b) implement procedures to facilitate the implementation of the risk assessment policy.',
      objective: 'To establish governance for risk assessment activities.',
      supplementalGuidance: 'Risk assessment policy and procedures address the controls in the RA family.',
      status: 'active'
    },
    {
      id: 'RA-3',
      title: 'Risk Assessment',
      description: 'Conduct an assessment of risk arising from the operation of the system.',
      family: 'Risk Assessment',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) conduct an assessment of risk arising from the operation of the information system and the associated processing, storage, or transmission of organizational information; (b) document risk assessment results in security plan, risk assessment report, or equivalent document; (c) review risk assessment results at least annually; (d) disseminate risk assessment results to designated personnel; and (e) update the risk assessment at least annually or whenever there are significant changes to the information system or environment of operation.',
      objective: 'To identify and analyze security risks.',
      supplementalGuidance: 'Clearly defined authorization boundaries are a prerequisite for effective risk assessments.',
      status: 'active'
    },
    {
      id: 'RA-5',
      title: 'Vulnerability Monitoring and Scanning',
      description: 'Monitor and scan for vulnerabilities in the system and hosted applications.',
      family: 'Risk Assessment',
      baseline: ['Low', 'Moderate', 'High'],
      priority: 'P1',
      requirements: 'Organizations must: (a) monitor and scan for vulnerabilities in the information system and hosted applications at least monthly and when new vulnerabilities potentially affecting the system/applications are identified and reported; (b) employ vulnerability monitoring tools and techniques that facilitate interoperability among tools and automate parts of the vulnerability management process by using standards for vulnerability categories, measures, and vulnerability impact descriptions; (c) analyze vulnerability scan reports and results from security control assessments; (d) remediate legitimate vulnerabilities in accordance with an organizational assessment of risk; and (e) share information obtained from the vulnerability monitoring process and security control assessments with designated personnel throughout the organization to help eliminate similar vulnerabilities in other information systems.',
      objective: 'To identify and remediate system vulnerabilities.',
      supplementalGuidance: 'Security categorization of information systems guides the frequency and comprehensiveness of vulnerability scans.',
      status: 'active'
    }
  ];

  /**
   * Load all NIST 800-53 controls into the database
   */
  async loadNISTControls(): Promise<{
    loaded: number;
    skipped: number;
    errors: string[];
  }> {
    console.log('Loading NIST 800-53 Rev 5 controls into database...');
    
    let loaded = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const controlData of this.NIST_800_53_CONTROLS) {
      try {
        // Check if control already exists
        const existingControl = await storage.getControl(controlData.id);
        if (existingControl) {
          skipped++;
          continue;
        }

        // Convert to database format
        const insertControl: InsertControl = {
          id: controlData.id,
          title: controlData.title,
          description: controlData.description,
          family: controlData.family,
          baseline: controlData.baseline,
          priority: controlData.priority,
          enhancement: controlData.enhancement,
          supplementalGuidance: controlData.supplementalGuidance,
          requirements: controlData.requirements,
          createdAt: new Date()
        };

        // Insert into database
        await storage.createControl(insertControl);
        loaded++;
        
        console.log(`✅ Loaded control ${controlData.id}: ${controlData.title}`);
      } catch (error) {
        const errorMsg = `Failed to load control ${controlData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`\n📊 NIST 800-53 Control Loading Summary:`);
    console.log(`   Loaded: ${loaded}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors.length}`);

    return { loaded, skipped, errors };
  }

  /**
   * Get all available NIST control families
   */
  getControlFamilies(): string[] {
    const families = new Set(this.NIST_800_53_CONTROLS.map(c => c.family));
    return Array.from(families).sort();
  }

  /**
   * Get controls by family
   */
  getControlsByFamily(family: string): NIST800_53Control[] {
    return this.NIST_800_53_CONTROLS.filter(c => c.family === family);
  }

  /**
   * Get controls by baseline
   */
  getControlsByBaseline(baseline: string): NIST800_53Control[] {
    return this.NIST_800_53_CONTROLS.filter(c => c.baseline.includes(baseline));
  }

  /**
   * Get a specific control by ID
   */
  getControlById(controlId: string): NIST800_53Control | undefined {
    return this.NIST_800_53_CONTROLS.find(c => c.id === controlId);
  }
}

// Export singleton instance
export const nistControlLoader = new NISTControlLoaderService();
