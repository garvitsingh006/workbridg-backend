export function formatProject(project) {
    return {
        id: project._id.toString(),
        title: project.title,
        description: project.description,
        createdBy: project.createdBy ? {
            id: project.createdBy._id.toString(),
            username: project.createdBy.username,
            email: project.createdBy.email,
            fullName: project.createdBy.fullName,
            userType: project.createdBy.role,
            createdAt: project.createdBy.createdAt,
            updatedAt: project.createdBy.updatedAt
        } : null,
        assignedTo: project.assignedTo ? {
            id: project.assignedTo._id.toString(),
            username: project.assignedTo.username,
            email: project.assignedTo.email,
            fullName: project.assignedTo.fullName,
            userType: project.assignedTo.role,
            createdAt: project.assignedTo.createdAt,
            updatedAt: project.assignedTo.updatedAt
        } : null,
        status: project.status,
        deadline: project.deadline,
        budget: project.budget,
        category: project.category,
        paymentMethod: project.paymentMethod,
        remarks: project.remarks.map(remark => ({
            by: remark.by ? {
                id: remark.by._id.toString(),
                username: remark.by.username,
                email: remark.by.email,
                fullName: remark.by.fullName,
                userType: remark.by.role,
                createdAt: remark.by.createdAt,
                updatedAt: remark.by.updatedAt
            } : null,
            text: remark.text,
            createdAt: remark.createdAt
        })),
        hasRequestedAdminManagement: project.hasRequestedAdminManagement || false,
        adminManagementRequestedAt: project.adminManagementRequestedAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
    };
}
