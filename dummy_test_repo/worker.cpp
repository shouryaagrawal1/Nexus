#include <iostream>
#include <string>

void logError(const std::string& msg) {
    std::cerr << "[ERROR] " << msg << std::endl;
}

class AbstractWorker {
public:
    virtual void execute() = 0;
};

class BaseDBWorker : public AbstractWorker {
public:
    void retryConnection() {
        logError("Database connection lost. Initiating retry.");
    }

    void execute() override {
        retryConnection();
    }
};

int main() {
    BaseDBWorker worker;
    worker.execute();
    return 0;
}
